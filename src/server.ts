import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const httpserver = http.createServer(app);
const io = new Server(httpserver);

httpserver.listen(3000, () => console.log('server is running'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/view/index.html');
});

const users = {
    "1": { id: "1", name: "Alice", status: "online" },
    "2": { id: "2", name: "Bob", status: "online" },
    "3": { id: "3", name: "Charlie", status: "online" },
    "4": { id: "4", name: "Diana", status: "online" },
    "5": { id: "5", name: "Eve", status: "online" }
};

const userSockets = {};
const privateChats = {};
const offlineMessages = {};

io.on('connection', (socket) => {
    console.log('user connected', socket.id);

    const userId = Object.keys(users)[Math.floor(Math.random() * 5)];
    userSockets[userId] = socket.id;
    const userName = users[userId].name;
    socket.emit('userDetails', { id: userId, name: userName });
    io.emit('updateUsers', Object.values(users));

    if (offlineMessages[userId]) {
        offlineMessages[userId].forEach(msg => {
            socket.emit('message', msg);
        });
        delete offlineMessages[userId];
    }

    socket.on('message', (msg, targetId = null) => {
        const now = new Date();
        const date = now.toLocaleDateString();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const timestamp = `${date} ${time}`;

        const message = { username: users[userId].name, msg, timestamp, userId, targetId };

        if (targetId) {
            const targetSocketId = userSockets[targetId];
            if (targetSocketId) {
                io.to(targetSocketId).emit('message', message);
                socket.emit('message', message);
            } else {
                if (!offlineMessages[targetId]) {
                    offlineMessages[targetId] = [];
                }
                offlineMessages[targetId].push(message);
            }
        } else {
            io.emit('message', message);
        }
    });

    socket.on('startPrivateChat', (targetId) => {
        privateChats[socket.id] = targetId;
        privateChats[targetId] = socket.id;
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
        delete userSockets[userId];
        io.emit('updateUsers', Object.values(users));
    });
});
