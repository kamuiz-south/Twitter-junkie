document.addEventListener('DOMContentLoaded', () => {
    // Open Options Page
    document.getElementById('tj-open-options').addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    // Reset button action
    const resetBtn = document.getElementById('tj-reset-pos');
    resetBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'tj_reset_button_pos' }, (response) => {
                    // Optional: show a quick "Done!" feedback on the button text
                    const originalText = resetBtn.textContent;
                    resetBtn.textContent = 'Reset Done!';
                    setTimeout(() => { resetBtn.textContent = originalText; }, 1500);
                });
            }
        });
    });
});
