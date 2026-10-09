let recognition;
let isListening = false;
let fakeCallActive = false;

// ========================================
// LIVE CLOUDFLARE BACKEND
// ========================================

const API_BASE_URL =
    "https://ai-receptionist-backend.gaurav24giri.workers.dev";


// ========================================
// SEND MESSAGE TO AI
// ========================================

async function sendMessage(messageFromVoice = null) {

    const input = document.getElementById("messageInput");
    const chatBox = document.getElementById("chatBox");

    const nameInput = document.getElementById("customerName");
    const phoneInput = document.getElementById("customerPhone");
    const emailInput = document.getElementById("customerEmail");

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim();

    const message =
        messageFromVoice || input.value.trim();

    if (name === "") {
        alert("Please enter your name.");
        nameInput.focus();
        return;
    }

    if (phone === "") {
        alert("Please enter your phone number.");
        phoneInput.focus();
        return;
    }

    if (email === "") {
        alert("Please enter your email address.");
        emailInput.focus();
        return;
    }

    if (message === "") {
        return;
    }

    // Show customer message

    chatBox.innerHTML += `
        <div class="user">
            <strong>👤 ${escapeHTML(name)}:</strong><br>
            ${escapeHTML(message)}
        </div>
    `;

    input.value = "";

    chatBox.scrollTop = chatBox.scrollHeight;

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/message`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    name: name,
                    phone: phone,
                    email: email,
                    message: message
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(
                data.error || "Server error"
            );

        }

        const reply =
            data.reply ||
            "Sorry, something went wrong.";

        // Show AI reply

        chatBox.innerHTML += `
            <div class="bot">

                🤖 <strong>AI Receptionist:</strong><br>

                ${escapeHTML(reply)}

            </div>
        `;

        // Urgent request

        if (data.urgent) {

            chatBox.innerHTML += `
                <div class="urgent-message">

                    🚨 URGENT REQUEST FLAGGED

                </div>
            `;

        }

        chatBox.scrollTop =
            chatBox.scrollHeight;

        // Speak AI reply

        speakReply(reply, function () {

            if (fakeCallActive) {

                setTimeout(function () {

                    if (fakeCallActive) {
                        startVoiceInput();
                    }

                }, 500);

            }

        });

    } catch (error) {

        console.error(
            "AI Receptionist API Error:",
            error
        );

        chatBox.innerHTML += `
            <div class="bot">

                ❌ Unable to connect to AI Receptionist server.

            </div>
        `;

    }

}


// ========================================
// START FAKE PHONE CALL
// ========================================

function startFakeCall() {

    const name =
        document.getElementById("customerName")
            .value.trim();

    const phone =
        document.getElementById("customerPhone")
            .value.trim();

    const email =
        document.getElementById("customerEmail")
            .value.trim();

    if (!name || !phone || !email) {

        alert(
            "Please enter Name, Phone and Email first."
        );

        return;

    }

    fakeCallActive = true;

    document.getElementById("callStatus").innerHTML =
        "🟢 <strong>Call Connected</strong> — AI Receptionist is preparing...";

    document.getElementById("callButton")
        .style.display = "none";

    document.getElementById("endCallButton")
        .style.display = "inline-block";

    const chatBox =
        document.getElementById("chatBox");

    chatBox.innerHTML += `

        <div class="call-message">

            📞 <strong>Incoming Call Connected</strong><br>

            Customer: ${escapeHTML(name)}<br>

            Phone: ${escapeHTML(phone)}

        </div>

    `;

    const greeting =
        "Hello! Welcome to Gaurav Tech Solutions. How can I help you today?";

    chatBox.innerHTML += `

        <div class="bot">

            🤖 <strong>AI Receptionist:</strong><br>

            ${greeting}

        </div>

    `;

    chatBox.scrollTop =
        chatBox.scrollHeight;

    // AI greeting finishes first.
    // ONLY THEN microphone starts.

    speakReply(greeting, function () {

        if (!fakeCallActive) {
            return;
        }

        document.getElementById("callStatus").innerHTML =
            "🟢 <strong>Call Connected</strong> — AI Receptionist is listening...";

        setTimeout(function () {

            if (fakeCallActive) {
                startVoiceInput();
            }

        }, 500);

    });

}


// ========================================
// END CALL
// ========================================

function endFakeCall() {

    fakeCallActive = false;

    if (recognition) {

        try {
            recognition.stop();
        } catch (error) {
            console.log(error);
        }

    }

    // Stop AI speech

    if ("speechSynthesis" in window) {

        window.speechSynthesis.cancel();

    }

    document.getElementById("callStatus").innerHTML =
        "☎️ Call ended";

    document.getElementById("callButton")
        .style.display = "inline-block";

    document.getElementById("endCallButton")
        .style.display = "none";

    document.getElementById("voiceStatus").innerText =
        "Call ended.";

}


// ========================================
// VOICE INPUT
// ========================================

function startVoiceInput() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        alert(
            "Voice recognition is not supported. Please use Google Chrome."
        );

        return;

    }

    if (isListening) {
        return;
    }

    recognition =
        new SpeechRecognition();

    recognition.lang = "en-IN";

    recognition.continuous = false;

    recognition.interimResults = false;

    const status =
        document.getElementById("voiceStatus");

    const voiceButton =
        document.getElementById("voiceButton");

    recognition.onstart = function () {

        isListening = true;

        voiceButton.innerHTML = "🔴";

        status.innerText =
            "🎤 Listening... Speak now.";

    };

    recognition.onresult = function (event) {

        const spokenText =
            event.results[0][0].transcript;

        document.getElementById("messageInput")
            .value = spokenText;

        status.innerText =
            "✅ Voice received. Sending to AI...";

        sendMessage(spokenText);

    };

    recognition.onerror = function (event) {

        console.error(
            "Voice error:",
            event.error
        );

        isListening = false;

        voiceButton.innerHTML = "🎤";

        status.innerText =
            "❌ Voice error. Please try again.";

    };

    recognition.onend = function () {

        isListening = false;

        voiceButton.innerHTML = "🎤";

    };

    try {

        recognition.start();

    } catch (error) {

        console.log(
            "Recognition start error:",
            error
        );

    }

}


// ========================================
// AI VOICE OUTPUT
// ========================================

function speakReply(text, onDone = null) {

    if (!("speechSynthesis" in window)) {

        if (onDone) {
            onDone();
        }

        return;

    }

    window.speechSynthesis.cancel();

    const speech =
        new SpeechSynthesisUtterance(text);

    speech.lang = "en-IN";

    speech.rate = 0.95;

    speech.pitch = 1;

    speech.onend = function () {

        if (onDone) {
            onDone();
        }

    };

    window.speechSynthesis.speak(speech);

}


// ========================================
// ENTER KEY
// ========================================

function handleEnter(event) {

    if (event.key === "Enter") {

        sendMessage();

    }

}


// ========================================
// SAFE HTML
// ========================================

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent =
        String(text);

    return div.innerHTML;

}


// ========================================
// CHANNEL SWITCHING
// ========================================

function showChannel(channel) {

    const chatSection =
        document.getElementById("chatSection");

    const callSection =
        document.getElementById("callSection");

    const dmSection =
        document.getElementById("dmSection");

    const buttons =
        document.querySelectorAll(".channel");

    chatSection.style.display = "none";
    callSection.style.display = "none";
    dmSection.style.display = "none";

    buttons.forEach(function(button) {

        button.classList.remove("active");

    });

    if (channel === "chat") {

        chatSection.style.display = "block";

        buttons[0].classList.add("active");

    }

    if (channel === "dm") {

        dmSection.style.display = "block";

        buttons[1].classList.add("active");

    }

    if (channel === "call") {

        callSection.style.display = "block";

        buttons[2].classList.add("active");

    }

}


// ========================================
// START DM DEMO
// ========================================

function activateDM() {

    showChannel("chat");

    const chatBox =
        document.getElementById("chatBox");

    chatBox.innerHTML += `

        <div class="bot">

            📩 <strong>DM Receptionist:</strong><br>

            Hello! 👋 Welcome to Gaurav Tech Solutions.
            How can I help you today?

        </div>

    `;

    chatBox.scrollTop =
        chatBox.scrollHeight;

    speakReply(
        "Hello! Welcome to Gaurav Tech Solutions. How can I help you today?"
    );

}