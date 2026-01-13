// Save this as frontend/static/js/upload-worker.js
self.onmessage = function(e) {
    const file = e.data.file;
    const chunkSize = 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        self.postMessage({
            type: 'chunk',
            chunk: e.target.result,
            current: currentChunk,
            total: totalChunks
        });
        
        currentChunk++;
        if (currentChunk < totalChunks) {
            readNextChunk();
        } else {
            self.postMessage({
                type: 'complete'
            });
        }
    };
    
    function readNextChunk() {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        reader.readAsArrayBuffer(chunk);
    }
    
    readNextChunk();
};