const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const heicConvert = require('heic-convert');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

app.use(express.static('.')); 
app.use(express.json({ limit: '50mb' })); 

// Helper function to convert base64 to buffer
function base64ToBuffer(base64) {
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
}

// Helper function to convert buffer to base64
function bufferToBase64(buffer, mimeType = 'image/jpeg') {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

// Add HEIC conversion endpoint
app.post('/convert-heic', async (req, res) => {
    try {
        const imageData = req.body.image;
        if (!imageData) {
            throw new Error('No image data received');
        }

        const imageBuffer = base64ToBuffer(imageData);
        
        const jpegBuffer = await heicConvert({
            buffer: imageBuffer,
            format: 'JPEG',
            quality: 0.9
        });

        const base64Jpeg = bufferToBase64(jpegBuffer);
        res.json({ image: base64Jpeg });
    } catch (error) {
        console.error('HEIC Conversion Error:', error);
        res.status(500).json({ 
            error: 'Failed to convert HEIC image',
            details: error.message 
        });
    }
});

// Existing transcribe endpoint
app.post('/transcribe', async (req, res) => {
    try {
        const imageData = req.body.image;
        
        if (!imageData || !imageData.startsWith('data:image/')) {
            throw new Error('Invalid image data received');
        }

        console.log('Sending image to Claude...'); // Debug log

        const message = await anthropic.messages.create({
            model: "claude-3-opus-20240229",
            max_tokens: 1024,
            messages: [{
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `You are analyzing a wine menu. Extract all wines and create a markdown table with these columns:
                        Color | Year | Country | Type | Estate | Region | Price | Rating

                        Important:
                        1. Only include actual wines
                        2. Research missing information and mark with (est.)
                        3. For ratings, use this format: "92/100" and if estimated add "(est.)"
                        4. Format prices exactly as shown in the menu
                        5. For Color, use: 🔴 Red, ⚪ White, 🌸 Rosé
                        6. If information is uncertain, wrap in *italics*
                        7. Sort wines by color, then by price
                        8. Add a summary line below the table with total wines and average rating

                        Please analyze the wine menu in the image and format the results as requested.`
                    },
                    {
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: "image/jpeg",
                            data: imageData.replace(/^data:image\/\w+;base64,/, '')
                        }
                    }
                ]
            }]
        });

        // Extract the text content from Claude's response
        const analysisText = message.content[0].text;
        console.log('Claude Analysis:', analysisText);

        res.json({ 
            wineAnalysis: analysisText
        });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ 
            error: 'Failed to process image',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 