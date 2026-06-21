let currentUtterance = null;
let isSpeaking = false;

document.addEventListener('DOMContentLoaded', () => {
    const narrateBtn = document.getElementById('voice-narrate-btn');
    if (narrateBtn) {
        narrateBtn.addEventListener('click', () => {
            const countyName = document.getElementById('modal-county-name')?.textContent;
            if (countyName) {
                narrateCountySituation(countyName);
            }
        });
    }
});

function narrateCountySituation(countyName) {
    if (isSpeaking) {
        window.speechSynthesis.cancel();
        isSpeaking = false;
        return;
    }

    const countyData = window.COUNTIES?.[countyName];
    if (!countyData) return;

    let text = `Situation report for ${countyName} County. `;
    text += `County capital is ${countyData.capital}. `;

    const countyDisasters = (window.allRealDisasters || []).filter(d => d.county === countyName);
    if (countyDisasters.length > 0) {
        text += `ALERT: There are currently ${countyDisasters.length} active disaster situation(s) in ${countyName}. `;
        countyDisasters.forEach(d => {
            text += `A ${d.severity} severity ${d.type} has been detected. ${d.description || ''} `;
            if (d.advice) text += `Recommended action: ${d.advice} `;
        });
    } else {
        text += `No active disasters currently detected in ${countyName}. All systems normal. `;
    }

    const now = new Date();
    text += `Report generated at ${now.toLocaleTimeString('en-KE')} on ${now.toLocaleDateString('en-KE')}. `;
    text += `This is DEWS Kenya, propelled by Ramogi Institute of Advanced Technology.`;

    speakText(text);
}

function speakText(text) {
    if (!('speechSynthesis' in window)) {
        showToast('Text-to-speech not supported in this browser', 'warning');
        return;
    }

    window.speechSynthesis.cancel();

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.rate = 0.9;
    currentUtterance.pitch = 1;
    currentUtterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'))
        || voices.find(v => v.lang.startsWith('en'))
        || voices[0];
    if (enVoice) currentUtterance.voice = enVoice;

    currentUtterance.onstart = () => { isSpeaking = true; };
    currentUtterance.onend = () => { isSpeaking = false; };
    currentUtterance.onerror = () => { isSpeaking = false; };

    window.speechSynthesis.speak(currentUtterance);
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

function stopSpeaking() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        isSpeaking = false;
    }
}

window.narrateCountySituation = narrateCountySituation;
window.speakText = speakText;
window.stopSpeaking = stopSpeaking;
