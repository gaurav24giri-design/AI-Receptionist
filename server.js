require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");

const app = express();
const PORT = 3000;

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ========================================
// DATA SETUP
// ========================================

const dataFolder = path.join(__dirname, "data");
const messagesFile = path.join(dataFolder, "messages.json");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}

if (!fs.existsSync(messagesFile)) {
    fs.writeFileSync(messagesFile, "[]", "utf8");
}

// ========================================
// EMAIL SETUP
// ========================================

let emailTransporter = null;

if (
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.OWNER_EMAIL
) {
    emailTransporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    console.log("Email notification system enabled.");
} else {
    console.log(
        "Email notification system not configured. Dashboard alerts will still work."
    );
}

// ========================================
// CUSTOMER SESSIONS
// ========================================

const sessions = new Map();

function getSession(sessionId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
            history: [],
            name: "",
            phone: "",
            email: ""
        });
    }

    return sessions.get(sessionId);
}

// ========================================
// CONTACT DETAILS EXTRACTION
// ========================================

function extractPhone(message) {
    const phoneMatch = message.match(
        /(?:\+91[\s-]?)?[6-9]\d{9}/
    );

    return phoneMatch ? phoneMatch[0] : "";
}

function extractEmail(message) {
    const emailMatch = message.match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    );

    return emailMatch ? emailMatch[0] : "";
}

function extractName(message) {
    const patterns = [
        /my name is\s+([a-zA-Z ]+)/i,
        /i am\s+([a-zA-Z ]+)/i,
        /i'm\s+([a-zA-Z ]+)/i,
        /name is\s+([a-zA-Z ]+)/i
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);

        if (match) {
            let name = match[1].trim();

            name = name
                .replace(/and.*$/i, "")
                .replace(/my phone.*$/i, "")
                .trim();

            if (name.length > 1) {
                return name;
            }
        }
    }

    return "";
}

// ========================================
// SAVE CUSTOMER MESSAGE
// ========================================

function saveCustomerMessage(
    message,
    urgent,
    reply,
    customer
) {
    try {
        let messages = [];

        const existingData = fs.readFileSync(
            messagesFile,
            "utf8"
        );

        try {
            messages = JSON.parse(existingData);
        } catch {
            messages = [];
        }

        messages.push({
            id: Date.now(),

            message: message,

            urgent: urgent,

            customer: {
                name: customer.name || "",
                phone: customer.phone || "",
                email: customer.email || ""
            },

            reply: reply,

            createdAt: new Date().toISOString()
        });

        fs.writeFileSync(
            messagesFile,
            JSON.stringify(messages, null, 2),
            "utf8"
        );

        console.log("Customer message saved.");

    } catch (error) {
        console.error(
            "Message save error:",
            error
        );
    }
}

// ========================================
// URGENT EMAIL NOTIFICATION
// ========================================

async function sendUrgentNotification(
    message,
    reply,
    customer
) {
    if (!emailTransporter) {
        console.log(
            "Urgent email skipped: SMTP is not configured."
        );
        return;
    }

    try {
        await emailTransporter.sendMail({
            from: `"AI Receptionist" <${process.env.SMTP_USER}>`,
            to: process.env.OWNER_EMAIL,

            subject:
                "🚨 URGENT CUSTOMER REQUEST - Gaurav Tech Solutions",

            html: `
                <div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;">

                    <h2 style="color:#dc2626;">
                        🚨 Urgent Customer Request
                    </h2>

                    <p>
                        An urgent customer message has been received
                        by your AI Receptionist.
                    </p>

                    <hr>

                    <h3>Customer Details</h3>

                    <p>
                        <strong>Name:</strong>
                        ${customer.name || "Not provided"}
                    </p>

                    <p>
                        <strong>Phone:</strong>
                        ${customer.phone || "Not provided"}
                    </p>

                    <p>
                        <strong>Email:</strong>
                        ${customer.email || "Not provided"}
                    </p>

                    <h3>Customer Message</h3>

                    <p>
                        ${message}
                    </p>

                    <h3>AI Reply</h3>

                    <p>
                        ${reply}
                    </p>

                    <hr>

                    <p>
                        <strong>Gaurav Tech Solutions</strong>
                    </p>

                    <p>
                        This notification was generated automatically
                        by the AI Receptionist.
                    </p>

                </div>
            `
        });

        console.log(
            "🚨 Urgent notification email sent."
        );

    } catch (error) {
        console.error(
            "Urgent email error:",
            error.message
        );
    }
}

// ========================================
// STATUS
// ========================================

app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        message:
            "AI Receptionist backend is running!"
    });
});

// ========================================
// GET ALL MESSAGES
// ========================================

app.get("/api/messages", (req, res) => {
    try {
        const data = fs.readFileSync(
            messagesFile,
            "utf8"
        );

        const messages = JSON.parse(data);

        res.json({
            success: true,
            messages: messages
        });

    } catch (error) {
        console.error(
            "Messages read error:",
            error
        );

        res.status(500).json({
            success: false,
            messages: []
        });
    }
});

// ========================================
// DELETE MESSAGE
// ========================================

app.delete("/api/messages/:id", (req, res) => {
    try {
        const messageId =
            Number(req.params.id);

        const data =
            fs.readFileSync(
                messagesFile,
                "utf8"
            );

        let messages =
            JSON.parse(data);

        const oldLength =
            messages.length;

        messages =
            messages.filter(
                message =>
                    message.id !== messageId
            );

        if (messages.length === oldLength) {
            return res.status(404).json({
                success: false,
                message:
                    "Message not found."
            });
        }

        fs.writeFileSync(
            messagesFile,
            JSON.stringify(
                messages,
                null,
                2
            ),
            "utf8"
        );

        res.json({
            success: true,
            message:
                "Message deleted successfully."
        });

    } catch (error) {
        console.error(
            "Delete error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to delete message."
        });
    }
});

// ========================================
// AI RECEPTIONIST
// ========================================

app.post("/api/message", async (req, res) => {

    try {

        const {
            message,
            sessionId,
            name,
            phone,
            email
        } = req.body;

        if (
            !message ||
            !message.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Message is required."
            });
        }

        const currentSessionId =
            sessionId ||
            "default-session";

        const session =
            getSession(currentSessionId);

        // ========================================
        // CUSTOMER FORM DETAILS
        // ========================================

        if (name && name.trim()) {
            session.name = name.trim();
        }

        if (phone && phone.trim()) {
            session.phone = phone.trim();
        }

        if (email && email.trim()) {
            session.email = email.trim();
        }

        // ========================================
        // EXTRACT DETAILS FROM MESSAGE
        // ========================================

        const detectedName =
            extractName(message);

        const detectedPhone =
            extractPhone(message);

        const detectedEmail =
            extractEmail(message);

        if (detectedName) {
            session.name = detectedName;
        }

        if (detectedPhone) {
            session.phone = detectedPhone;
        }

        if (detectedEmail) {
            session.email = detectedEmail;
        }

        // ========================================
        // BUSINESS INFORMATION
        // ========================================

        const businessInformation = `
Business Name:
Gaurav Tech Solutions

Business Hours:
Monday–Saturday, 10 AM–7 PM

Sunday:
Closed

Phone:
9876543210

Email:
support@example.com

Services:
Web Development
Software Development
AI Solutions
`;

        // ========================================
        // CONVERSATION HISTORY
        // ========================================

        session.history.push({
            role: "user",
            content: message
        });

        if (session.history.length > 10) {
            session.history =
                session.history.slice(-10);
        }

        // ========================================
        // AI REQUEST
        // ========================================

        const response =
            await client.responses.create({

                model: "gpt-6-luna",

                instructions: `

You are an AI receptionist for Gaurav Tech Solutions.

BUSINESS INFORMATION:

${businessInformation}

YOUR JOB:

1. Welcome customers politely.

2. Answer questions using only the
business information provided.

3. Never invent business information.

4. Keep normal answers short,
friendly and professional.

5. Identify urgent requests.

6. If a customer has an urgent issue,
acknowledge that it is urgent.

7. If a customer has an urgent issue
and their contact details are not known,
ask for:
- Name
- Phone number
- Email address

8. If the customer already provided
some details, do not ask for those
details again.

9. If the customer wants to leave
a message, collect the message.

10. Never claim that you actually
called, emailed or notified the owner.

11. Tell the customer that the request
will be flagged for the business owner.

12. Be helpful and professional.

CURRENT CUSTOMER DETAILS:

Name:
${session.name || "Not provided"}

Phone:
${session.phone || "Not provided"}

Email:
${session.email || "Not provided"}

CONVERSATION:

${session.history
    .map(item =>
        `${item.role}: ${item.content}`
    )
    .join("\n")}

`,

                input: message
            });

        const reply =
            response.output_text;

        // ========================================
        // URGENT DETECTION
        // ========================================

        const urgentWords = [

            "urgent",
            "urgently",
            "emergency",
            "asap",
            "immediately",
            "critical",
            "important",
            "website is down",
            "server is down",
            "payment failed",
            "can't access",
            "cannot access"

        ];

        const lowerMessage =
            message.toLowerCase();

        const isUrgent =
            urgentWords.some(
                word =>
                    lowerMessage.includes(word)
            );

        // ========================================
        // SAVE MESSAGE
        // ========================================

        saveCustomerMessage(
            message,
            isUrgent,
            reply,
            session
        );

        // ========================================
        // SEND REAL OWNER ALERT
        // ========================================

        if (isUrgent) {

            await sendUrgentNotification(
                message,
                reply,
                session
            );

        }

        // ========================================
        // SAVE AI RESPONSE
        // ========================================

        session.history.push({
            role: "assistant",
            content: reply
        });

        // ========================================
        // RESPONSE
        // ========================================

        res.json({

            success: true,

            reply: reply,

            urgent: isUrgent,

            customer: {

                name: session.name,

                phone: session.phone,

                email: session.email

            }

        });

    } catch (error) {

        console.error(
            "OpenAI API Error:",
            error
        );

        res.status(500).json({

            success: false,

            reply:
                "Sorry, I am having trouble connecting to the AI right now."

        });

    }

});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {

    console.log(
        `AI Receptionist running at http://localhost:${PORT}`
    );

});