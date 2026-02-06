
const { JWT } = require('google-auth-library');
const axios = require('axios');
const path = require('path');

const FCM_ENDPOINT = "https://fcm.googleapis.com/v1/projects/star-business-3384a/messages:send";
const serviceAccount = path.join(__dirname, '../views', 'star-business-3384a-188261b7ed64.json');

// Initialize JWT client for Firebase
const client = new JWT({
    keyFile: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
});
export async function sendPushNotification(token: string, title: string, input: any) {
    if (!token || typeof token !== 'string') {
        console.error('Invalid or empty token.');
        return false;
    }

    try {
        const { token: accessToken } = await client.getAccessToken();

        if (!accessToken) {
            throw new Error('Failed to get access token');
        }

        console.log(`Sending notification to token: ${token}`, title, input);

        const message = {
            message: {
                token,
                notification: {
                    title,
                    body: input.content ?? '',
                },
                data: {
                    moduleName: input.moduleName ?? '',
                    moduleId: input.moduleId ?? ''
                },
            },
        };

        const response = await axios.post(FCM_ENDPOINT, message, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        console.log(`Notification sent successfully to token [${token}]:`, response.data);

        return response.data;

    } catch (error: any) {
        console.error('Error sending notification:', error?.response?.data ?? error.message);
        return false;
    }
}


