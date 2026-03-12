import postmark from 'postmark';

let client = null;

function getClient() {
    const token = process.env.POSTMARK_SERVER_TOKEN;
    if (!token) {
        throw new Error('POSTMARK_SERVER_TOKEN is missing');
    }

    if (!client) {
        client = new postmark.ServerClient(token);
    }

    return client;
}

export async function postmarkSend({ from, to, subject, textBody, messageStream = 'outbound' }) {
    const sender = from || process.env.POSTMARK_FROM_EMAIL;
    if (!sender) {
        throw new Error('POSTMARK_FROM_EMAIL is missing');
    }

    const payload = {
        From: sender,
        To: to,
        Subject: subject,
        TextBody: textBody,
        MessageStream: messageStream
    };

    return getClient().sendEmail(payload);
}

export async function postmarkSendWithTemplate({
    from,
    to,
    templateAlias,
    templateId,
    templateModel,
    messageStream = 'outbound'
}) {
    const sender = from || process.env.POSTMARK_FROM_EMAIL;
    if (!sender) {
        throw new Error('POSTMARK_FROM_EMAIL is missing');
    }

    const payload = {
        From: sender,
        To: to,
        MessageStream: messageStream,
        TemplateModel: templateModel || {}
    };

    if (templateAlias) {
        payload.TemplateAlias = templateAlias;
    } else if (templateId) {
        payload.TemplateId = Number(templateId);
    } else {
        throw new Error('TemplateAlias or TemplateId is required');
    }

    return getClient().sendEmailWithTemplate(payload);
}
