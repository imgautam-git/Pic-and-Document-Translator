document.addEventListener('DOMContentLoaded', () => {
    // Image Upload and Translation Section
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const fileNameDisplay = document.getElementById('file-name');
    const imagePreview = document.getElementById('image-preview');
    const detectedLanguageDisplay = document.getElementById('detected-language');
    const loadingSpinner = document.getElementById('loading-spinner');
    const translateBtn = document.getElementById('translate-btn');
    const translatedTextDisplay = document.getElementById('translated-text');
    const downloadBtn = document.getElementById('download-btn');
    const progressBar = document.getElementById('progress-bar');

    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        fileNameDisplay.textContent = `📄 ${file.name}`;
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);

        loadingSpinner.classList.remove('hidden');
        uploadBtn.disabled = true;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const uploadResponse = await fetch('/upload', { method: 'POST', body: formData });
            if (!uploadResponse.ok) {
                throw new Error(`HTTP error! status: ${uploadResponse.status}`);
            }
            const uploadResult = await uploadResponse.json();

            loadingSpinner.classList.add('hidden');
            uploadBtn.disabled = false;

            detectedLanguageDisplay.textContent = `Detected Language: ${uploadResult.detected_language}`;
            translateBtn.dataset.filename = uploadResult.filename;
            translateBtn.dataset.detectedLanguage = uploadResult.detected_language;
        } catch (error) {
            console.error("Error during image upload:", error);
            alert("An error occurred during image upload.");
            loadingSpinner.classList.add('hidden');
            uploadBtn.disabled = false;
        }
    });

    translateBtn.addEventListener('click', async () => {
        const filename = translateBtn.dataset.filename;
        const detectedLanguage = translateBtn.dataset.detectedLanguage;
        const direction = document.querySelector('input[name="direction"]:checked').value;

        if (!filename) {
            alert("Please upload an image first.");
            return;
        }

        translateBtn.disabled = true;
        loadingSpinner.classList.remove('hidden');

        progressBar.style.width = '0%';
        progressBar.style.display = 'block';

        let progress = 0;
        const interval = setInterval(() => {
            if (progress < 90) {
                progress += 10;
                progressBar.style.width = `${progress}%`;
            }
        }, 500);

        try {
            const response = await fetch('/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, direction, detected_language: detectedLanguage })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            clearInterval(interval);
            progressBar.style.width = '100%';
            setTimeout(() => progressBar.style.display = 'none', 500);

            loadingSpinner.classList.add('hidden');
            translateBtn.disabled = false;

            const result = await response.json();
            translatedTextDisplay.value = result.translated_text;
        } catch (error) {
            console.error("Error during translation:", error);
            alert("An error occurred during translation.");
            clearInterval(interval);
            progressBar.style.display = 'none';
            loadingSpinner.classList.add('hidden');
            translateBtn.disabled = false;
        }
    });

    downloadBtn.addEventListener('click', () => {
        const text = translatedTextDisplay.value;
        if (!text) {
            alert("No translated text to download.");
            return;
        }
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'translation.txt';
        a.click();
    });

    // Document Upload and Translation Section
    const documentInput = document.querySelector('input[name="document"]');
    const documentPreview = document.getElementById('document-preview');
    const translatedDocumentPreview = document.getElementById('translated-document-preview');
    const downloadDocumentBtn = document.getElementById('download-document-btn');
    const detectedDocumentLanguage = document.getElementById('detected-document-language');
    const documentTranslationForm = document.getElementById('document-translation-form');
    const translatedDocumentOutput = document.getElementById('translated-document-output');
    const translatedDocumentText = document.getElementById('translated-document-text');

    documentInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const maxSizeMB = 20; // Maximum file size in MB for documents
        const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes

        if (file.size > maxSize) {
            alert(`Document size exceeds the maximum allowed size of ${maxSizeMB} MB.`);
            documentInput.value = ''; // Clear the file input
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            documentPreview.textContent = e.target.result.substring(0, 500) + "...";
            documentPreview.style.display = 'block';
            detectDocumentLanguage(e.target.result);
        };

        if (file.type === "text/plain") {
            reader.readAsText(file);
        } else {
            reader.readAsDataURL(file);
        }
    });

    async function detectDocumentLanguage(text) {
        try {
            const response = await fetch('/detect_document_language', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            detectedDocumentLanguage.textContent = `Detected Language: ${result.language}`;
        } catch (error) {
            console.error("Error detecting document language:", error);
            detectedDocumentLanguage.textContent = "Language detection failed.";
        }
    }

    documentTranslationForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        translatedDocumentPreview.style.display = 'none';
        downloadDocumentBtn.style.display = 'none';
        translatedDocumentOutput.style.display = 'none';

        progressBar.style.width = '0%';
        progressBar.style.display = 'block';

        let progress = 0;
        const interval = setInterval(() => {
            if (progress < 90) {
                progress += 10;
                progressBar.style.width = `${progress}%`;
            }
        }, 500);

        try {
            const formData = new FormData(documentTranslationForm);
            const response = await fetch('/translate_document', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.text();
            translatedDocumentText.value = result;
            translatedDocumentPreview.textContent = result.substring(0, 500) + "...";
            translatedDocumentOutput.style.display = 'block';
            translatedDocumentPreview.style.display = 'block';
            downloadDocumentBtn.style.display = 'block';
            clearInterval(interval);
            progressBar.style.width = '100%';
            setTimeout(() => progressBar.style.display = 'none', 500);

        } catch (error) {
            console.error("Error translating document: ", error);
            alert("Error translating document.");
            clearInterval(interval);
            progressBar.style.display = 'none';
        }
    });

    downloadDocumentBtn.addEventListener('click', () => {
        const text = translatedDocumentText.value;
        if (!text) {
            alert("No translated text to download.");
            return;
        }
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'translated_document_text.txt';
        a.click();
    });
});