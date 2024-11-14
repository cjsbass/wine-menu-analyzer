// Get DOM elements
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const transcription = document.getElementById('transcription');
const resultContainer = document.querySelector('.result-container');
const progressOverlay = document.querySelector('.progress-overlay');

// Progress elements
const readProgress = document.getElementById('readProgress');
const convertProgress = document.getElementById('convertProgress');
const wineAnalysisProgress = document.getElementById('wineAnalysisProgress');
const readEta = document.getElementById('readEta');
const convertEta = document.getElementById('convertEta');
const wineAnalysisEta = document.getElementById('wineAnalysisEta');

// Click to upload
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

// Function to animate progress with ETA
function animateProgress(progressElement, etaElement, duration, startMessage = '') {
    return new Promise(resolve => {
        let startTime = Date.now();
        let progress = 0;
        
        if (startMessage) {
            etaElement.textContent = startMessage;
        }

        const interval = setInterval(() => {
            progress += 1;
            progressElement.value = Math.min(progress, 100);
            
            // Calculate and update ETA
            const elapsed = Date.now() - startTime;
            const estimatedTotal = elapsed * (100 / progress);
            const remaining = Math.max(0, (estimatedTotal - elapsed) / 1000);
            
            if (progress < 100) {
                etaElement.textContent = `ETA: ${remaining.toFixed(1)}s`;
            } else {
                etaElement.textContent = 'Completed';
                clearInterval(interval);
                resolve();
            }
        }, duration / 100); // Divide duration by 100 for smooth animation
    });
}

// Handle file processing
async function handleFile(file) {
    if (!file) return;

    try {
        progressOverlay.style.display = 'flex';
        resultContainer.style.display = 'grid';
        transcription.textContent = '';
        
        // Reading file with animation
        await animateProgress(readProgress, readEta, 2000, 'Reading file...');
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                let imageData = event.target.result;
                
                // HEIC conversion if needed
                if (file.type === "image/heic" || file.name.toLowerCase().endsWith('.heic')) {
                    convertProgress.value = 0;
                    convertEta.textContent = 'Converting HEIC...';
                    
                    const convertPromise = animateProgress(convertProgress, convertEta, 3000, 'Converting HEIC...');
                    
                    const response = await fetch('/convert-heic', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: imageData })
                    });
                    
                    if (!response.ok) throw new Error('Failed to convert HEIC image');
                    const result = await response.json();
                    imageData = result.image;
                    
                    await convertPromise;
                } else {
                    convertProgress.value = 100;
                    convertEta.textContent = 'Not needed';
                }

                // Display preview
                preview.src = imageData;
                preview.style.display = 'block';
                
                // Analyze with Claude
                await analyzeImage(imageData);
                
            } catch (error) {
                console.error('Error processing image:', error);
                showError(error.message);
            }
        };

        reader.onerror = (error) => {
            console.error('FileReader error:', error);
            showError('Failed to read the image file.');
        };

        reader.readAsDataURL(file);

    } catch (error) {
        console.error('Error processing image:', error);
        showError(error.message || 'Error processing image. Please try again.');
    }
}

// Analyze image with Claude
async function analyzeImage(imageData) {
    try {
        // Start analysis progress animation
        const analysisPromise = animateProgress(
            wineAnalysisProgress, 
            wineAnalysisEta, 
            15000, // Longer duration for Claude analysis
            'Analyzing with Claude...'
        );
        
        const response = await fetch('/transcribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageData })
        });
        
        const data = await response.json();
        
        if (!response.ok || data.error) {
            throw new Error(data.details || data.error || 'Server error');
        }
        
        if (data.wineAnalysis) {
            transcription.innerHTML = `
                <div class="wine-analysis">
                    <h3>Wine List Analysis</h3>
                    ${data.wineAnalysis.replace(/\*([^*]+)\*/g, '<span class="est">$1</span>')}
                </div>
            `;
            
            // Add tooltips to estimated values
            const estSpans = transcription.querySelectorAll('.est');
            estSpans.forEach(span => {
                span.setAttribute('title', 'Estimated value');
            });
            
            wineAnalysisProgress.value = 100;
            wineAnalysisEta.textContent = 'Completed';
            
            // Hide progress overlay after a short delay
            setTimeout(() => {
                progressOverlay.style.display = 'none';
            }, 1000);
        } else {
            throw new Error('No wine information found in image');
        }

    } catch (err) {
        console.error('Analysis error:', err);
        showError(err.message);
    }
}

// Show error message
function showError(message) {
    transcription.innerHTML = `<div class="error-message">${message}</div>`;
    resultContainer.style.display = 'grid';
    progressOverlay.style.display = 'none';
    
    // Update progress indicators to show error
    readEta.textContent = readProgress.value < 100 ? 'Error' : 'Completed';
    convertEta.textContent = convertProgress.value < 100 ? 'Error' : 'Completed';
    wineAnalysisEta.textContent = 'Error';
    wineAnalysisProgress.value = 0;
}

// Add click handler for upload button
document.querySelector('.upload-button').addEventListener('click', () => {
    fileInput.click();
}); 