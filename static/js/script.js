document.getElementById('upload-btn').addEventListener('click', () => {
    document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('file-name').textContent = `📄 ${file.name}`;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('image-preview').src = e.target.result;
        document.getElementById('image-preview').style.display = 'block';
    };
    reader.readAsDataURL(file);

    document.getElementById('loading-spinner').classList.remove('hidden');
    document.getElementById('upload-btn').disabled = true;

    const formData = new FormData();
    formData.append('file', file);

    const uploadResponse = await fetch('/upload', { method: 'POST', body: formData });
    const uploadResult = await uploadResponse.json();

    document.getElementById('loading-spinner').classList.add('hidden');
    document.getElementById('upload-btn').disabled = false;

    if (uploadResponse.status !== 200) {
        alert(uploadResult.error);
        return;
    }

    document.getElementById('detected-language').textContent = `Detected Language: ${uploadResult.detected_language}`;
    document.getElementById('translate-btn').dataset.filename = uploadResult.filename;
    document.getElementById('translate-btn').dataset.detectedLanguage = uploadResult.detected_language;
});

document.getElementById('translate-btn').addEventListener('click', async () => {
    const filename = document.getElementById('translate-btn').dataset.filename;
    const detectedLanguage = document.getElementById('translate-btn').dataset.detectedLanguage;
    const direction = document.querySelector('input[name="direction"]:checked').value;

    if (!filename) {
        alert("Please upload an image first.");
        return;
    }

    document.getElementById('translate-btn').disabled = true;
    document.getElementById('loading-spinner').classList.remove('hidden');

    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = '0%';
    progressBar.style.display = 'block';
    
    let progress = 0;
    const interval = setInterval(() => {
        if (progress < 90) {
            progress += 10;
            progressBar.style.width = `${progress}%`;
        }
    }, 500);

    const response = await fetch('/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, direction, detected_language: detectedLanguage })
    });

    clearInterval(interval);
    progressBar.style.width = '100%';
    setTimeout(() => progressBar.style.display = 'none', 500);
    
    document.getElementById('loading-spinner').classList.add('hidden');
    document.getElementById('translate-btn').disabled = false;

    const result = await response.json();
    if (response.status !== 200) {
        alert(result.error);
    } else {
        document.getElementById('translated-text').value = result.translated_text;
    }
});

document.getElementById('download-btn').addEventListener('click', () => {
    const text = document.getElementById('translated-text').value;
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
