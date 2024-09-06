import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';

const app = express();
const httpserver = http.createServer(app);

const io = new Server(httpserver, {
    maxHttpBufferSize: 1e8
});

httpserver.listen(3000, () => console.log('server is running'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/view/index.html'));
});

const users = {
    "1": { id: "1", img: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", phone: "(11)912345678", email: "alice@example.com", username: "Alice", status: "online" },
    "2": { id: "2", img: "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", phone: "(21)987654321", email: "bob@example.com", username: "Bob", status: "offline" },
    "3": { id: "3", img: "https://images.pexels.com/photos/3088526/pexels-photo-3088526.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", phone: "(31)923456789", email: "charlie@example.com", username: "Charlie", status: "offline" },
    "4": { id: "4", img: "https://images.pexels.com/photos/1102341/pexels-photo-1102341.jpeg", phone: "(41)934567890", email: "diana@example.com", username: "Diana", status: "offline" },
    "5": { id: "5", img: "https://images.pexels.com/photos/769690/pexels-photo-769690.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1", phone: "(51)945678901", email: "everaldo@example.com", username: "Everaldo", status: "online" }
};

const userSockets: any = {};
const privateChats: any = {};
const offlineMessages: any = {};

io.on('connection', (socket) => {
    const userId = Object.keys(users)[Math.random() < 0.5 ? 0 : 4];

    userSockets[userId] = socket.id;

    const userName = users[userId].username;

    socket.emit('userDetails', {
        id: userId,
        email: users[userId].email,
        phone: users[userId].phone,
        username: userName,
        img: users[userId].img,
        status: users[userId].status
    });

    io.emit('updateUsers', Object.values(users));

    if (offlineMessages[userId]) {
        offlineMessages[userId].forEach((msg: any) => {
            socket.emit('message', msg);
        });
        delete offlineMessages[userId];
    }

    socket.on('message', (msg, targetId = null) => {
        const now = new Date();
        const date = now.toLocaleDateString();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const timestamp = `${date} ${time}`;

        const message = {
            username: users[userId].username,
            msg,
            timestamp,
            userId,
            targetId,
            img: users[userId].img
        };

        if (targetId) {
            const targetSocketId = userSockets[targetId];
            if (targetSocketId) {
                io.to(targetSocketId).emit('message', message);
                socket.emit('message', message);
            } else {
                socket.emit('message', message);
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
