const express = require("express");
const app = express();
const emailValidator = require("email-validator");
var fs = require("fs"); // Read file.json
let port = process.env.PORT || 3000;

// CORS policy for response from another website
app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader("Content-Type", "application/json");
    next();
});

// Receive JSON request body with POST and PUT
app.use(express.json());

app.listen(port, () => {
    console.log(`Ticket Management API is listening on port http://localhost:${port}`);
});

app.get("/", (req, res) => {
    return res.send({
        message: "Welcome to ticket management api",
        description: "This is an assignment for internship in full-stack developer department",
        documentation: "https://kinkando.github.io/nipa-ticket-api-documentation/"
    });
});

app.get("/ticket/all", (req, res) => {
    let status_sort = verifySortParams(req.query.status_sort); // asc, desc, default, undefined
    let update_sort = verifySortParams(req.query.update_sort); // asc, desc, default, undefined

    if (status_sort == undefined || update_sort == undefined) {
        var tickets = null,
            status = false,
            message = `Invalid information`;
    } else {
        const jsonData = readJSONFile('ticket.json'); // Read file
        var status = jsonData['tickets'].length > 0,
            message = status ? `${jsonData['tickets'].length} ticket(s)` : "Ticket is empty",
            tickets = jsonData['tickets'];

        // Specific attribute sort
        if (status_sort !== "default" || update_sort !== 'default') {
            // Sort status, update
            if (status_sort !== "default" && update_sort !== "default") {
                tickets = groupTicket(tickets, 'status', status_sort, update_sort);
            }

            // Sort only status
            else if (status_sort !== "default") {
                tickets = groupTicket(tickets, 'status', status_sort);
            }

            // Sort only update
            else {
                tickets = sortTicket(tickets, 'latest_update_timestamp', update_sort);
            }
        }
    }

    const response = {
        status,
        message,
        tickets,
    };

    res.send(response);
});

app.get("/ticket/filter/:status", (req, res) => {
    const statusFilter = req.params.status; // pending, accepted, resolved, rejected
    const sort = verifySortParams(req.query.sort); // asc, desc, default, undefined

    // Wrong information params
    if (sort == undefined) {
        var tickets = [],
            status = false,
            message = `Invalid information`;
    } else {
        const jsonData = readJSONFile('ticket.json'); // Read file

        var tickets = jsonData['tickets'].filter(element => element['status'] == statusFilter), // Filter ticket by status
            status = tickets != undefined && tickets != null && tickets.length > 0,
            message = status ? `${statusFilter}: ${tickets.length} ticket(s)` : `No ${statusFilter} ticket was found`;

        // Sort tickets by latest_update_timestamp
        if (['desc', 'asc'].includes(sort)) {
            tickets = sortTicket(tickets, 'latest_update_timestamp', sort);
        }
    }

    const response = {
        status,
        message,
        tickets: tickets.length != 0 ? tickets : null,
    }

    return res.send(response);
});

app.get("/ticket/get/:id", (req, res) => {
    // Read file
    const jsonData = readJSONFile('ticket.json');

    const ticket = jsonData['tickets'].find(element => element['id'] == req.params.id);
    var status = ticket != undefined;
    var message = status ? "Found ticket" : "Invalid ticket id";

    const response = {
        status,
        message,
        ticket,
    };

    res.send(response);
})

app.post("/ticket/create", (req, res) => {
    // Generate timestamp
    const timestamp = getTimestamp();

    if (ticketValidate(req.body)) {
        // Read file
        const jsonData = readJSONFile('ticket.json');

        // Generate new ticket
        var ticket = {
            id: jsonData['tickets'].length + 1,
            title: req.body.title.trim(),
            description: req.body.description.trim(),
            contact_information: {
                requester_name: req.body.name.trim(),
                requester_tel: req.body.tel,
                requester_email: req.body.email,
                channel: req.body.channel.trim(),
            },
            status: "pending",
            create_timestamp: timestamp,
            latest_update_timestamp: timestamp,
        };

        jsonData['tickets'].push(ticket); // Add new ticket
        writeJSONFile(jsonData, 'ticket.json'); // Overwrite file

        var status = true;
        var message = "Create new ticket successful";
    } else {
        var status = false;
        var message = "Invalid information"
    }

    const response = {
        status,
        message,
        ticket: status ? ticket : null,
    }
    res.send(response);
});

app.put('/ticket/update', (req, res) => {
    const id = req.body.id;

    // if not exist id params
    if (isNone(id) || isNaN(id)) {
        var status = false;
        var message = "Invalid ticket";
        var ticket = null;
    } else {
        const jsonData = readJSONFile('ticket.json'); // Read file
        // find ticket by ticket id
        for (var i = 0; i < jsonData['tickets'].length; i++) {
            if (jsonData['tickets'][i]['id'] == id) {
                var ticket = jsonData['tickets'][i];
                break;
            }
        }
        // not found
        if (isNone(ticket)) {
            var status = false;
            var message = "Ticket was not found";
            var ticket = null;
        }
        // found ticket
        else {
            // update ticket
            let result = updateTicket(ticket, req.body);
            let isUpdate = result != undefined && result['isUpdate'];

            // Response attribute
            var status = isUpdate,
                message = result == undefined ? "Invalid ticket information" :
                isUpdate ? "Update ticket successful" : "Ticket information is not changed";
            ticket = isUpdate ? result['data'] : null;

            // validate information that correct and update ticket
            if (isUpdate) {
                jsonData['tickets'][i] = ticket;
                writeJSONFile(jsonData, 'ticket.json'); // Overwrite file
            }
        }
    }

    const response = {
        status,
        message,
        ticket,
    };

    return res.send(response);
});

function readJSONFile(file) {
    return JSON.parse(fs.readFileSync(file));
}

function writeJSONFile(json, file) {
    fs.writeFile(file, JSON.stringify(json, null, 4), function(err) {
        if (err) {
            throw err;
        }
    });
}

function verifySortParams(sort) {
    // DEFAULT desc and verify before to lower case letters
    return sort == undefined || sort == null ?
        "default" : ['asc', 'desc'].includes(sort.toString().toLowerCase()) ?
        sort.toString().toLowerCase() : undefined;
}

function ticketValidate(ticket) {
    return !(isNone(ticket.title) || isNone(ticket.description) ||
        isNone(ticket.name) || isNone(ticket.tel) || isNone(ticket.email) ||
        isNone(ticket.channel) || !isTelNumber(ticket.tel) ||
        !emailValidator.validate(ticket.email) || !channelValidate(ticket.channel));
}

function channelValidate(channel) {
    return ['Facebook', 'Line', 'Web Form'].includes(channel)
}

function statusValidate(status) {
    return ['pending', 'accepted', 'resolved', 'rejected'].includes(status)
}

function updateTicket(ticket, request) {
    // if invalid tel, email, channel or status, but it's not None
    if ((!isNone(request.tel) && !isTelNumber(request.tel)) ||
        (!isNone(request.email) && !emailValidator.validate(request.email)) ||
        (!isNone(request.channel) && !channelValidate(request.channel)) ||
        (!isNone(request.status) && !statusValidate(request.status))) {
        return undefined;
    }

    let isUpdate = false;

    // iteration for update each information
    for (let key in request) {
        // ignore to update id
        if (key === 'id') {
            continue;
        }

        // not empty information
        if (!isNone(request[key])) {
            // key in map of contact_information
            if (['name', 'tel', 'email', 'channel'].includes(key)) {
                var objKey = key !== 'channel' ? `requester_${key}` : key; // add partial key name

                // Sensitive space only in verify of email and tel
                var value = ['tel', 'email'].includes(key) ? request[key] : request[key].trim();
                isUpdate = setUpdate(isUpdate, ticket['contact_information'][objKey], value)
                ticket['contact_information'][objKey] = value;
            } else {
                isUpdate = setUpdate(isUpdate, ticket[key], request[key].trim())
                ticket[key] = request[key].trim();
            }
        }
    }
    // update timestamp
    if (isUpdate) {
        ticket['latest_update_timestamp'] = getTimestamp();
    }
    return {
        data: ticket,
        isUpdate,
    };
}

function getTimestamp() {
    let datetime = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Bangkok',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).replace(' 24:', ' 00:'); // get current datetime

    // Iteration to replaceAll , with empty character
    while (datetime.includes(',')) {
        datetime = datetime.replace(',', '');
    }
    return datetime;
}

function setUpdate(isUpdate, ticket, request) {
    // Update handle
    if (!isUpdate) {
        return ticket != request;
    }
    return isUpdate;
}

function isNone(value) {
    return value == null || value == undefined || value.toString().trim().length === 0;
}

function isTelNumber(tel) {
    // Accepted only integer 10 digits
    return !(tel.length != 10 || isNaN(tel) || tel.includes("-") || tel.includes('.'));
}

function sortTicket(tickets, keySort, order) {
    const dirModifier = order === 'asc' ? 1 : -1;
    tickets.sort((a, b) => {
        let valueA = keySort.includes('timestamp') ? new Date(a[keySort]) : a[keySort],
            valueB = keySort.includes('timestamp') ? new Date(b[keySort]) : b[keySort];
        return valueA > valueB ? (1 * dirModifier) : (-1 * dirModifier);
    });
    return tickets;
}

function groupTicket(tickets, key, sortGroup, sortSubGroup = undefined) {
    // { keyA: [valueA1, valueA2, ...], keyB: [valueB1, valueB2, ...], ... }
    let resultGroup = {};

    for (let i = 0; i < tickets.length; i++) {
        // Create array of unique key, if it's not exist
        if (resultGroup[tickets[i][key]] == undefined) {
            resultGroup[tickets[i][key]] = [];
        }

        // Add each data into array depend on specific key
        resultGroup[tickets[i][key]].push(tickets[i])
    }

    // Sort only keys [ keyA, keyB, keyC ]
    const dirModifier = sortGroup === 'asc' ? 1 : -1;
    const sortKey = Object.keys(resultGroup).sort((a, b) => a > b ? (1 * dirModifier) : (-1 * dirModifier));

    // [ valueA1, valueA2, ..., valueB1, ... ]
    const results = [];

    // Fetch value from array of each key into results array
    for (let key of sortKey) {
        if (sortSubGroup == undefined) {
            results.push(...resultGroup[key]);
        }
        // sort each key with latest_update_timestamp
        else {
            results.push(...sortTicket(resultGroup[key], 'latest_update_timestamp', sortSubGroup.toLowerCase()));
        }
    }
    return results;
}