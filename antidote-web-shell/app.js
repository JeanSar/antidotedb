'use strict';

const compose_cmd = 'docker compose'

const antidote = require('antidote_ts_client');
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const compression = require('compression');
const helmet = require('helmet');

const conf = require('./config');
const { stringify } = require('querystring');

const DEBUG = true;
function log(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

const app = express();

app.use(helmet());
app.use(compression()); // Compress all routes
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const viewPath = __dirname + '/views/';

// Cache of partition info
// TODO change this if the web server is replicated
let partitionInfo = new Map();
for (let i = 1; i <= conf.antidote.length; i++) {
    partitionInfo.set(i, true);
}

// Initialize Antidote clients
let atdClis = [];
for (let i in conf.antidote) {
    atdClis.push(antidote.connect(conf.antidote[i].port, conf.antidote[i].host));
}

/* Static web page routing. */
const staticRouter = express.Router();
staticRouter.get('/', function (req, res, next) {
    res.sendFile(viewPath + 'index.html');
});
staticRouter.get('/tasks', function (req, res, next) {
    res.sendFile(viewPath + 'index-tasks.html');
});
app.use("/", staticRouter);

/* API routing. */
const apiRouter = express.Router();

// Set API
apiRouter.route('/:rep_id/set/:set_id')
    .get(function (req, res) {
        let repId = parseInt(req.params.rep_id);
        let setId = req.params. set_id;
        atdClis[repId-1].set(setId).read().then(content => {
            log('Get', setId, 'from replica', repId);
            res.json({ status: 'OK', cont: content });
        });
    })
    .put(function (req, res) {
        let repId = parseInt(req.params.rep_id);
        let setId = req.params.set_id;
        let value = req.body.value;
        atdClis[repId-1].update(
            atdClis[repId-1].set(setId).add(value)
        ).then(resp => {
            log('Add', value, 'to', setId, 'on replica', repId)
            res.json({ status: 'OK' });
        });
    })
    .delete(function (req, res) {
        let repId = parseInt(req.params.rep_id);
        let setId = req.params.set_id;
        let value = req.body.value;
        atdClis[repId-1].update(
            atdClis[repId-1].set(setId).remove(value)
        ).then(resp => {
            log('Remove', value, 'from', setId, 'on replica', repId)
            res.json({ status: 'OK' });
        });
    });

// Counter API
apiRouter.route('/:rep_id/count/:counter_id')
    .get(function (req, res) {
        let repId = parseInt(req.params.rep_id);
        let counterId = req.params.counter_id;
        atdClis[repId-1].counter(counterId).read().then(content => {
            log('Get', counterId, 'from replica', repId);
            res.json({ status: 'OK', cont: content });
        });
    })
    .put(function (req, res) {
        let repId = parseInt(req.params.rep_id);
        let counterId = req.params.counter_id;
        atdClis[repId-1].update(
            atdClis[repId-1].counter(counterId).increment(1)
        ).then(resp => {
            log('Increment', counterId, 'on replica', repId)
            res.json({ status: 'OK' });
        });
    })
    .delete(function (req, res) {
        let repId = parseInt(req.params.rep_id);
        let counterId = req.params.counter_id;
        atdClis[repId-1].update(
            atdClis[repId-1].counter(counterId).increment(-1)
        ).then(resp => {
            log('Decrement', counterId, 'on replica', repId)
            res.json({ status: 'OK' });
        });
    });


// Tasks list API
apiRouter.route('/:rep_id/tasks')
    .get(function (req, res) {
        let repId = parseInt(req.params.rep_id);
        atdClis[repId-1].rrmap("tasks").read().then(content => {
            let obj = content.toJsObject();
            log('Get all tasks from replica', repId, ' ; ', obj);
            res.json({ status: 'OK', cont: obj });
        });
    });

// Tasks API
apiRouter.route('/:rep_id/tasks/:task_id')
    .get(function (req, res) {
        let repId = parseInt(req.params.rep_id);
        let taskId = req.params.task_id;
        atdClis[repId-1].rrmap("tasks").rrmap(taskId).read().then(content => {
            let obj = content.toJsObject();
            log('Get tasks ', taskId,' from replica', repId, ' ; ', obj);
            res.json({ status: 'OK', cont: obj});
        });
    })
    .put(function (req, res) {
        let repId = parseInt(req.params.rep_id);
        let taskId = req.params.task_id;
        let desc = req.body.desc;
        let priority = req.body.priority;
        let deadline = req.body.deadline;
        let statut = req.body.statut;
        let user = req.body.user;
        atdClis[repId-1].update([
            atdClis[repId-1].rrmap("tasks").rrmap(taskId).register("desc").set(desc),
            atdClis[repId-1].rrmap("tasks").rrmap(taskId).register("priority").set(priority),
            atdClis[repId-1].rrmap("tasks").rrmap(taskId).register("deadline").set(deadline),
            atdClis[repId-1].rrmap("tasks").rrmap(taskId).register("statut").set(statut),
            atdClis[repId-1].rrmap("tasks").rrmap(taskId).register("user").set(user)
        ]).then(resp => {
            log('Add new task ', taskId, ' on replica ', repId)
            res.json({ status: 'OK' });
        });
    })
    .delete(function (req, res) {
        let repId = parseInt(req.params.rep_id);
        let taskId = req.params.task_id;

        atdClis[repId-1].update(
            atdClis[repId-1].rrmap("tasks").remove(atdClis[repId-1].rrmap("tasks").rrmap(taskId))
        ).then(resp => {
            log('Remove task ', taskId, ' on replica ', repId)
            res.json({ status: 'OK' });
        });
    });

const command = (type, param) => {
    switch (type) {
        case 'ispart':
            return `${compose_cmd} -f docker/docker-antidote.yml exec --privileged antidote${param} bash -c 'iptables -L -n -v'`
        case 'create':
            return `${compose_cmd} -f docker/docker-antidote.yml exec -d --privileged antidote${param} bash -c \
            'iptables -A INPUT -p tcp --dport 8086 -j DROP; iptables -A OUTPUT -p tcp --dport 8086 -j DROP';`;
        case 'remove':
            return `${compose_cmd} -f docker/docker-antidote.yml exec -d --privileged antidote${param} bash -c \
            'iptables -D INPUT -p tcp --dport 8086 -j DROP; iptables -D OUTPUT -p tcp --dport 8086 -j DROP';`
    }

}

// Network partition API
apiRouter.route('/:rep_id/part')
    .get(function (req, res) {
        let repId = parseInt(req.params.rep_id);
        let value = partitionInfo.get(repId) ? 'ON' : 'OFF';
        res.json({ status: value, rep: repId });
    })
    .put(function (req, res) {
        let repId = parseInt(req.params.rep_id);
        if (!partitionInfo.get(repId)) {
            log('Partition replica', repId, 'already set');
            res.json({ status: 'OK', rep: repId });
        } else {
            spawn(command('create', repId), {shell: true})
                .on('exit', function (code) {
                    if (code === 0) {
                        log('Partition replica', repId);
                        partitionInfo.set(repId, false);
                        res.json({ status: 'OK', rep: repId });
                    } else {
                        log('Erreur dans create partition');
                        res.status(500).json({status:'Failed', rep: repId});
                    }
                });
        }
    })
    .delete(function (req, res) {
        let repId = parseInt(req.params.rep_id);
        if (partitionInfo.get(repId)) {
            log('Partition replica', repId, 'already removed');
            res.json({ status: 'OK', rep: repId });
        } else {

            spawn(command('remove', repId), {shell: true})
                .on('exit', function (code) {
                    if (code === 0) {
                        log('Remove partition over replica', repId);
                        partitionInfo.set(repId, true);
                        res.json({ status: 'OK', rep: repId });
                    } else {
                        log('Erreur dans remove partition');
                        res.status(500).json({status:'Failed', rep: repId});
                    }
                });
        }
    });

app.use("/api", apiRouter);

/* Else, 404-error routing. */
app.use("*", function (req, res) {
    res.sendFile(viewPath + "404.html");
});

module.exports = app;
