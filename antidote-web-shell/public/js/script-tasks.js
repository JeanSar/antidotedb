const NUM_TERMS = 3;

const OK_MSG = 'OK';
const ERROR_MSG = 'ERROR';
const UNKNOWN_MSG = 'command not found';

const POLLING_INTERVAL = 5000; // -1 == OFF

const HELP_MSG = `
tasks commands:
    tasks add <tasks_id> <value>
    tasks remove <tasks_id> <value>
    tasks get <task_list_id> <tasks_id>
    tasks list <tasks_list>
`;

const CMDS = ['tasks', 'help', 'get', 'add',
    'remove', 'list'];

document.onkeydown = function (e) {
    // Alt+[1,2,..,9] to switch between terminals
    if (e.altKey && (e.keyCode >= 49 && e.keyCode <= 57)) {
        terms[e.keyCode - 49].focus();
    }
};

$(document).ready(function () {
    // FIXME : Remove this code
    // Create fake todo list
    const fakeTaskLists = [
        {
            title: 'TIW 8 Task name 1',
            description: "The task's short description 1",
            priority: 'high',
            date: 1680213599000,
            status: 'todo',
            assignee: 'user1'
        },
        {
            title: 'TIW 8 Task name 2',
            description: "The task's short description 2",
            priority: 'medium',
            date: 1680213599000,
            status: 'doing',
            assignee: 'user2'
        },
        {
            title: 'TIW 8 Task name 3',
            description: "The task's short description 3",
            priority: 'low',
            date: 1680213499000,
            status: 'done',
            assignee: 'user2'
        }
    ]

    const groupedTasks = groupTasksByStatus(fakeTaskLists)

    for (let i = 1; i <= NUM_TERMS; i++) {
        $("#tasks" + i).append(
            renderList(groupedTasks.get('todo'), 'todo'),
            renderList(groupedTasks.get('doing'), 'doing'),
            renderList(groupedTasks.get('done'), 'done')
        );
    }
});

var terms = [];

$(function () {
    for (i = 1; i <= NUM_TERMS; i++) {
        // Initialize terminals
        terms.push(
            $('#term' + i).terminal(evalAtdCmd, {
                greetings: false,
                height: 240,
                prompt: `user${i}@tasks> `,
                tabcompletion: true,
                completion: CMDS,
                name: i
            })
        );
    }
    terms[0].focus();

    for (let i = 1; i <= NUM_TERMS; i++) {
        // NB: use of let for block scoping 
        // see https://stackoverflow.com/a/750506

        // Set partitioning button logic
        $('#btn-part' + i).click(function () {
            if (!$('#part' + i).hasClass('partitioned')) {
                $.ajax({
                    url: '/api/' + i + '/part',
                    type: 'PUT',
                    dataType: 'json',
                    success: function (data) {
                        setPartitionGui(data.rep);
                    }
                });
            } else {
                $.ajax({
                    url: '/api/' + i + '/part',
                    type: 'DELETE',
                    dataType: 'json',
                    success: function (data) {
                        unsetPartitionGui(data.rep);
                    }
                });
            }
        });
    }

    // Get current partitioning state
    function doPoll() {
        for (let i = 1; i <= NUM_TERMS; i++) {
            $.getJSON('/api/' + i + '/part', function (data) {
                if (data.status === 'ON') {
                    unsetPartitionGui(data.rep);
                } else if (data.status === 'OFF') {
                    setPartitionGui(data.rep);
                }
            });
        }
        if (POLLING_INTERVAL > 0)
            setTimeout(doPoll, POLLING_INTERVAL);
    }
    doPoll();
});

function setPartitionGui(i) {
    $("#part" + i).addClass('partitioned');
    $("#btn-part" + i).addClass('btn-success').removeClass('btn-danger');
    $("#btn-part" + i).html('Heal partition');
}
function unsetPartitionGui(i) {
    $("#part" + i).removeClass('partitioned');
    $("#btn-part" + i).addClass('btn-danger').removeClass('btn-success');
    $("#btn-part" + i).html('Create partition');
}

function evalAtdCmd(cmd, term) {
    if (cmd == null || cmd == "") return;
    var args = cmd.split(" ");
    let tid = parseInt(term.name()) - 1;
    let okErrOutput = function (res) {
        terms[tid].echo(res.status === 'OK' ? OK_MSG : ERROR_MSG);
    };
    switch (args[0]) {
        case "tasks":
            switch (args[1]) {
                case "get":
                    terms[tid].echo("Not implemented yet");
                    break;
                case "add":
                    terms[tid].echo("Not implemented yet");
                    break;
                case "remove":
                    terms[tid].echo("Not implemented yet");
                    break;
                case "list":
                    terms[tid].echo("Not implemented yet");
                    break;
                default:
                    terms[tid].echo(UNKNOWN_MSG);
            };
            break;
        case "help":
            terms[tid].echo(HELP_MSG);
            break;
        default:
            terms[tid].echo(UNKNOWN_MSG)
    }
}

function groupTasksByStatus(tasks) {
    const map = new Map();
    tasks.forEach((item) => {
        const key = item.status;
        const collection = map.get(key);
        if (!collection) {
            map.set(key, [item]);
        } else {
            collection.push(item);
        }
    });
    return map;
}

function renderList(taskListInfos, status) {
    return `
        <div class="card">
            <div class="d-flex justify-content-between align-items-center">
                <span class="font-weight-bold">${status}</span>
            </div>
            ${taskListInfos.map(renderTask).join('')}
        </div>
    `
}

function renderTask({ title, description, priority, date }) {
    return `
        <div class="mt-3">
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex flex-row align-items-center">
                    <div class="d-flex flex-column">
                        <span>${title}</span>
                        <div class="d-flex flex-row align-items-center time-text">
                            <small>${description}</small>
                            <span class="dots"></span>
                            <small>${priority}</small>
                            <span class="dots"></span>
                            <small>${new Date(date).toLocaleString()}</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
}