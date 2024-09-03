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
    "1": { id: "1", img: "https://www.pessoacomdeficiencia.sp.gov.br/wp-content/uploads/2024/08/Natacao_AS_036-1-scaled-e1724964134231-425x253.jpeg", name: "Alice", status: "online" },
    "2": { id: "2", img: "https://www.designi.com.br/images/preview/12161378.jpg", name: "Bob", status: "offline" },
    "3": { id: "3", img: "https://blog.unyleya.edu.br/wp-content/uploads/2017/12/saiba-como-a-educacao-ajuda-voce-a-ser-uma-pessoa-melhor.jpeg", name: "Charlie", status: "online" },
    "4": { id: "4", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcShfSmaz1Gbjq5Bt00OuV1gUU_pU2NMZkHs3g&s", name: "Diana", status: "offline" },
    "5": { id: "5", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcROZ2ZV8f_IBk865E7bEObKgFmfnBsorNTXcA&s", name: "Eve", status: "offline" }
};

const userSockets = {};
const privateChats = {};
const offlineMessages = {};

io.on('connection', (socket) => {
    console.log('user connected', socket.id);

    const userId = Object.keys(users)[0];
    userSockets[userId] = socket.id;

    const userName = users[userId].name;
    socket.emit('userDetails', { id: userId, name: userName, img: users[userId].img, status: users[userId].status });
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
