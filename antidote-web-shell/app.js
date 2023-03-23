'use strict';

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
apiRouter.route('/:rep_id/tasks/:list_id')
    .get(function (req, res) {
        // TODO: implement
        res.json({ status: 'TODO', cont: 'Implement logic' });
    });

// Tasks API
apiRouter.route('/:rep_id/tasks/:list_id/:task_id')
    .get(function (req, res) {
        // TODO: implement
        res.json({ status: 'TODO', cont: 'Implement logic' });
    })
    .put(function (req, res) {
        // TODO: implement
        res.json({ status: 'TODO', cont: 'Implement logic' });
    })
    .delete(function (req, res) {
        // TODO: implement
        res.json({ status: 'TODO', cont: 'Implement logic' });
    });

const command = (type, param) => {
    switch (type) {
        case 'ispart':
            return `docker-compose -f docker/docker-antidote-3dcs.yml exec --privileged antidote${param} bash -c 'iptables -L -n -v'`
        case 'create':
            return `docker-compose -f docker/docker-antidote-3dcs.yml exec -d --privileged antidote${param} bash -c \
            'iptables -A INPUT -p tcp --dport 8086 -j DROP; iptables -A OUTPUT -p tcp --dport 8086 -j DROP';`;
        case 'remove':
            return `docker-compose -f docker/docker-antidote-3dcs.yml exec -d --privileged antidote${param} bash -c \
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
