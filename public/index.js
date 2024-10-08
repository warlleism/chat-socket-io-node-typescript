var socket = io();
const messageList = document.getElementById('messages');
const userList = document.getElementById('userList');
const userDetails = document.getElementById('userDetails');
const chatHeader = document.getElementById('chatHeader');
const user_container = document.getElementById('user-container');
const inputFile = document.getElementById('inputFile');
const outputDiv = document.querySelector('.output-div');

let userId;
let username;
let currentChatUserId = null;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('chatDatabase', 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('messages')) {
                db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}


async function saveMessage(messageData) {
    try {
        const db = await openDatabase();
        const transaction = db.transaction('messages', 'readwrite');
        const store = transaction.objectStore('messages');
        store.put(messageData);
        await transaction.complete;
    } catch (error) {
        console.error('Error saving message:', error);
    }
}


async function loadMessages() {
    if (currentChatUserId === null) return;

    const createElement = (tag, props = {}) => Object.assign(document.createElement(tag), props);

    try {
        const db = await openDatabase();
        const transaction = db.transaction('messages', 'readonly');
        const store = transaction.objectStore('messages');
        const request = store.getAll();

        request.onsuccess = () => {
            const savedMessages = request.result;
            const messagesToRender = savedMessages.filter(msg =>
                (msg.userId === userId && msg.targetId === currentChatUserId) ||
                (msg.targetId === userId && msg.userId === currentChatUserId)
            );
            messagesToRender.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            messageList.innerHTML = '';

            messagesToRender.forEach(msg => {
                const li = document.createElement('li');

                const usernameDiv = document.createElement('div');
                usernameDiv.textContent = msg.username;
                usernameDiv.className = 'username';

                const messageDiv = document.createElement('div');
                messageDiv.className = 'message';

                if (msg.msg.startsWith('data:image')) {
                    const img = createElement('img', {
                        src: msg.msg,
                        style: 'width: 100%; height: 300px; object-fit: cover; margin-bottom: 10px;',
                    });
                    messageDiv.appendChild(img);
                } else if (msg.msg.startsWith('data:application/pdf')) {
                    const pdfFrame = createElement('iframe', {
                        src: msg.msg,
                        style: 'width: 100%; height: 300px; border: none; margin-bottom: 10px;',
                    });
                    messageDiv.appendChild(pdfFrame);
                } else if (msg.msg.startsWith('data:video')) {
                    const video = createElement('video', {
                        src: msg.msg,
                        controls: true,
                        style: 'width: 100%; height: 300px; object-fit: cover; margin-bottom: 10px;',
                    });
                    messageDiv.appendChild(video);
                } else if (msg.msg.startsWith('data:audio/')) {
                    const audio = createElement('audio', {
                        src: msg.msg,
                        controls: true,
                        style: 'width: 100%; margin-bottom: 10px;',
                    });
                    messageDiv.appendChild(audio);
                } else {
                    messageDiv.textContent = msg.msg;
                }

                const timeDiv = document.createElement('div');
                timeDiv.textContent = msg.timestamp;
                timeDiv.className = 'time';

                li.appendChild(usernameDiv);
                li.appendChild(messageDiv);
                li.appendChild(timeDiv);

                li.className = msg.userId === userId ? 'self' : 'other';
                messageList.appendChild(li);
            });
        };

        request.onerror = () => {
            console.error('Error loading messages:', request.error);
        };
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

socket.on('userDetails', ({ id, username, img: imgSrc, email: userEmail, phone: userPhone }) => {

    const createElement = (tag, props = {}) => Object.assign(document.createElement(tag), props);
    const appendChildren = (parent, ...children) => children.forEach(child => parent.appendChild(child));

    userId = id;
    localStorage.setItem('userId', userId);

    const img = createElement('img', { src: imgSrc });
    const name = createElement('div', { textContent: username });
    const profileTitle = createElement('div', { textContent: 'Perfil', style: 'margin: 30px auto; width: fit-content; font-size: 2rem; font-weight: 500; color: #fff;' });
    const email = createElement('div', { textContent: userEmail });
    const phone = createElement('div', { textContent: userPhone });

    const profileDiv = createElement('div', { className: 'see-profile-container', style: 'display: none;' });
    const profileRowImg = createElement('div');
    const profileRowImgContainer = createElement('div', { className: 'profile-row-img-container' });
    const profileRowInfo = createElement('div', { className: 'profile-row-info-personal' });
    const profileRow = createElement('div', { className: 'profile-row-info' });
    const iconSpan = createElement('span', { className: 'material-symbols-outlined close-icon', style: 'margin-right: 10px; font-size: 1.5rem;', textContent: 'arrow_back_ios' });

    appendChildren(userDetails, img, name);
    appendChildren(profileRowImg, img.cloneNode(true));
    appendChildren(profileRowImgContainer, profileRowImg);
    appendChildren(profileRowInfo, name.cloneNode(true), email, phone);
    appendChildren(profileRow, profileRowImgContainer, profileRowInfo);
    appendChildren(profileDiv, profileTitle, iconSpan, profileRow);
    user_container.appendChild(profileDiv);

    img.addEventListener('click', () => profileDiv.style.display = 'block');
    iconSpan.addEventListener('click', () => profileDiv.style.display = 'none');
});

socket.on('updateUsers', (users) => {
    userList.innerHTML = '';
    Object.values(users).filter(user => user.id !== userId).forEach((user) => {
        const li = document.createElement('li');
        const img = document.createElement('img');
        const statusDiv = document.createElement('div');

        img.src = user.img;
        li.appendChild(img);
        li.appendChild(document.createTextNode(user.username));

        statusDiv.className = user.status === 'online' ? 'online status' : 'offline status';
        li.appendChild(statusDiv);

        li.dataset.id = user.id;

        li.addEventListener('click', () => {
            startPrivateChat(user.id, user);
        });

        userList.appendChild(li);
    });
});


inputFile.addEventListener('change', (event) => {
    const file = inputFile.files[0];

    const createElement = (tag, props = {}) => Object.assign(document.createElement(tag), props);

    if (file) {
        const fileName = file.name;
        const fileType = file.type;
        const fileSizeInBytes = file.size;
        const fileSizeInKB = fileSizeInBytes / 1024 ? `Tamanho do arquivo: ${fileSizeInBytes.toFixed(2)} KB` : `Tamanho do arquivo: ${fileSizeInBytes.toFixed(2)} MB`

        const reader = new FileReader();

        reader.onload = () => {
            const base64 = reader.result;

            const outputDiv = createElement('div', { style: 'left: 50%; gap: 10px; height: 19%; width: 96%; bottom: 90px; display: flex; margin: 0 auto; overflow: hidden; position: absolute; padding: 10px; background-color: #ffffff; border-radius: 5px; transform: translateX(-50%); border: dashed 1px #0000006b;' });
            outputDiv.className = 'output-div';

            const outputDivCollumn = createElement('div', {
                style: 'display: column'
            });

            const fileNameElement = createElement('p', {
                textContent: `Nome do Arquivo: ${fileName}`,
                style: 'font-size: 1.2rem; color: #272727; margin-bottom: 5px; letter-spacing: -.3px;'
            });

            const fileTypeElement = createElement('p', {
                textContent: `Tipo do Arquivo: ${fileType}`,
                style: 'font-size: .9rem; color: #000000a8; margin-bottom: 5px;'
            });

            const fileSizeElement = createElement('p', {
                textContent: fileSizeInKB,
                style: 'font-size: .8rem; color: #000000a8;'
            });

            const deleteIcon = createElement('span', {
                className: 'material-symbols-outlined',
                textContent: 'delete_forever',
                style: 'font-size: 1.5rem; color: rgba(0, 0, 0, 0.66); cursor: pointer; position: absolute; right: 13px; top: 11px; padding: 10px; border-radius: 100px; background: #efefef;'
            });

            deleteIcon.addEventListener('click', () => {
                inputFile.value = '';
                outputDiv.remove();
            })

            let mediaElement;

            if (fileType.startsWith('image')) {
                mediaElement = createElement('img', { src: base64, style: 'width: 217px; height: 100%; object-fit: cover' });
            } else if (fileType.startsWith('video')) {
                mediaElement = createElement('video', { src: base64, controls: true, style: 'width: 217px; height: 100%; object-fit: cover' });
                mediaElement.controls = true;
                mediaElement.autoplay = true;
            } else if (fileType.startsWith('audio')) {
                mediaElement = createElement('audio', { src: base64, controls: true, style: 'width: 92%; position: absolute; height: 74%;' });
            } else if (fileType.startsWith('application/pdf')) {
                mediaElement = createElement('iframe', { src: base64, style: 'width: 217px; height: 100%;', type: 'application/pdf' });
            }

            if (mediaElement) {
                outputDiv.appendChild(mediaElement);
            }
            outputDivCollumn.appendChild(fileNameElement);
            outputDivCollumn.appendChild(fileTypeElement);
            outputDivCollumn.appendChild(fileSizeElement);
            outputDiv.appendChild(deleteIcon);
            outputDiv.appendChild(outputDivCollumn);

            messages.appendChild(outputDiv);
        };

        reader.readAsDataURL(file);
    }
});


document.getElementById('messageForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('input');
    const file = inputFile.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result;
            const messageData = { msg: base64 !== '' ? base64 : input.value };

            if (messageData.msg !== '' && currentChatUserId) {
                input.value = '';
                inputFile.value = '';
                socket.emit('message', messageData.msg, currentChatUserId);
            }
        };
        reader.readAsDataURL(file);
    } else {
        const messageData = { msg: input.value };

        if (messageData.msg !== '' && currentChatUserId) {
            socket.emit('message', messageData.msg, currentChatUserId);
            input.value = '';
        }
    }

});

socket.on('message', (data) => {

    const createElement = (tag, props = {}) => Object.assign(document.createElement(tag), props);

    const li = createElement('li', {
        className: data.userId === userId ? 'self' : 'other',
    });

    const usernameDiv = createElement('div', {
        textContent: data.username,
        className: 'username',
    });

    const messageDiv = createElement('div', { className: 'message' });

    if (data.msg.startsWith('data:image')) {
        const img = createElement('img', {
            src: data.msg,
            style: 'width: 100%; height: 300px; object-fit: cover; margin-bottom: 10px;',
        });
        messageDiv.appendChild(img);
    } else if (data.msg.startsWith('data:video')) {
        const video = createElement('video', {
            src: data.msg,
            controls: true,
            autoplay: true,
            style: 'width: 100%; height: 300px; object-fit: cover; margin-bottom: 10px;',
        });
        messageDiv.appendChild(video);
    } else if (data.msg.startsWith('data:audio/')) {
        const audio = createElement('audio', {
            src: data.msg,
            controls: true,
            style: 'width: 100%; margin-bottom: 10px;',
        });
        messageDiv.appendChild(audio);
    } else if (data.msg.startsWith('data:application/pdf')) {
        const pdfFrame = createElement('iframe', {
            src: data.msg,
            style: 'width: 100%; height: 300px; border: none; margin-bottom: 10px;',
        });
        messageDiv.appendChild(pdfFrame);
    } else {
        messageDiv.textContent = data.msg;
    }

    const timeDiv = createElement('div', {
        textContent: data.timestamp,
        className: 'time',
    });

    li.append(usernameDiv, messageDiv, timeDiv);
    messageList.appendChild(li);
    saveMessage(data);

    const target = data.targetId === userId ? data.userId : data.targetId;
    startPrivateChat(target, data);

});

function startPrivateChat(targetId, data) {
    inputFile.value = '';
    document.querySelectorAll('#userList li').forEach(li => li.classList.remove('selected-user'));
    const targetUser = Array.from(userList.children).find(li => li.dataset.id === targetId);
    if (targetUser) {
        targetUser.classList.add('selected-user');
        currentChatUserId = targetId;
        loadMessages();
        socket.emit('startPrivateChat', targetId);
    }

    if (data.userId === userId) {
        return
    }

    chatHeader.innerHTML = '';
    const headerImg = document.createElement('img');
    headerImg.src = data.img;
    const divName = document.createElement('div');
    divName.textContent = data.username;
    chatHeader.appendChild(headerImg);
    chatHeader.appendChild(divName);
    setTimeout(() => {
        messageList.scrollTop = messageList.scrollHeight * 100;
    }, 100)
}
