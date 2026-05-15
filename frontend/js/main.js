window.onload = () => { 
    if (typeof loadDashboard === 'function') loadDashboard(); 
    if (typeof loadCollection === 'function') loadCollection(); 
    if (typeof loadHistory === 'function') loadHistory(); 
    if (typeof restoreTimerState === 'function') restoreTimerState(); 
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
};
