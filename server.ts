import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';

const app = express();
const httpserver = http.createServer(app);
const io = new Server(httpserver);

httpserver.listen(3000, () => console.log('server is running'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/view/index.html'));
});

const users = {
    "1": { id: "1", img: "https://www.pessoacomdeficiencia.sp.gov.br/wp-content/uploads/2024/08/Natacao_AS_036-1-scaled-e1724964134231-425x253.jpeg", phone: "(27)995804151", email: "warlleimartins@hotmail.com", username: "Alice", status: "online" },
    "2": { id: "2", img: "https://www.designi.com.br/images/preview/12161378.jpg", phone: "(27)995804151", email: "warlleimartins@hotmail.com", username: "Bob", status: "offline" },
    "3": { id: "3", img: "https://blog.unyleya.edu.br/wp-content/uploads/2017/12/saiba-como-a-educacao-ajuda-voce-a-ser-uma-pessoa-melhor.jpeg", phone: "(27)995804151", email: "warlleimartins@hotmail.com", username: "Charlie", status: "online" },
    "4": { id: "4", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcShfSmaz1Gbjq5Bt00OuV1gUU_pU2NMZkHs3g&s", phone: "(27)995804151", email: "warlleimartins@hotmail.com", username: "Diana", status: "offline" },
    "5": { id: "5", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcROZ2ZV8f_IBk865E7bEObKgFmfnBsorNTXcA&s", phone: "(27)995804151", email: "warlleimartins@hotmail.com", username: "Everaldo", status: "offline" }
};

const userSockets = {};
const privateChats = {};
const offlineMessages = {};

io.on('connection', (socket) => {
    // console.log('user connected', socket.id);

    const userId = Object.keys(users)[Math.floor(Math.random() * 5)];
    userSockets[userId] = socket.id;

    const userName = users[userId].username;

    socket.emit('userDetails', { id: userId, email: users[userId].email, phone: users[userId].phone, username: userName, img: users[userId].img, status: users[userId].status });
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

        const message = { username: users[userId].username, msg, timestamp, userId, targetId, img: users[userId].img };

        if (targetId) {
            const targetSocketId = userSockets[targetId];
            console.log(targetSocketId)
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
