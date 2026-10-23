// System Clock
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    document.getElementById('sys-time').textContent = timeStr;
}
setInterval(updateClock, 1000);
updateClock();

// Navigation Tabs
const navBtns = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.terminal-content section');

function switchTab(targetId) {
    // Remove active class from all
    navBtns.forEach(b => b.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active-section'));

    // Set active nav btn
    const targetBtn = document.querySelector(`.nav-btn[data-target="${targetId}"]`);
    if(targetBtn) targetBtn.classList.add('active');
    
    // Set active section
    document.getElementById(targetId).classList.add('active-section');

    // If weather section is opened and not loaded, load it
    if (targetId === 'weather' && !weatherLoaded) {
        initWeather();
    }
}

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        switchTab(btn.getAttribute('data-target'));
    });
});

// Inline Quick Links
document.querySelectorAll('.nav-link-inline').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(link.getAttribute('data-target'));
    });
});

// Weather Dashboard Logic
let weatherLoaded = false;


const WEATHER_URL = "https://api.ecowitt.net/api/v3/device/real_time"
 + "?application_key=D55FDBC9235F9886E2D7715A7B0E8149"
 + "&api_key=5f4fee86-c4b9-476b-8612-1746a5000029"
 + "&mac=FC:F5:C4:BA:FE:CB"
 + "&call_back=all"
 + "&temp_unitid=1"
 + "&wind_speed_unitid=7"
 + "&pressure_unitid=3"
 + "&rainfall_unitid=12";

function createWeatherCard(label, value, unit) {
    return `
        <div class="weather-card">
            <div class="w-label">${label}</div>
            <div class="w-value">${value} <span class="w-unit">${unit}</span></div>
        </div>
    `;
}

function initWeather() {
    weatherLoaded = true;
    fetchWeatherData();
    fetchHistoricalData();
    setInterval(fetchWeatherData, 30000); // refresh current reading every 30s
    setInterval(fetchHistoricalData, 300000); // refresh graph every 5 mins
}

async function fetchWeatherData() {
    try {
        const response = await fetch(WEATHER_URL);
        const data = await response.json();
        
        if (data.code === 0) {
            const d = data.data;
            const metricsDiv = document.getElementById('weather-metrics');
            
            let html = "";
            html += createWeatherCard("Temperature", d.outdoor.temperature.value, "°C");
            html += createWeatherCard("Humidity", d.outdoor.humidity.value, "%");
            html += createWeatherCard("Wind Speed", d.wind.wind_speed.value, "km/h");
            html += createWeatherCard("Pressure", d.pressure.relative.value, "hPa");
            html += createWeatherCard("Rainfall", d.rainfall.daily.value, "mm");
            html += createWeatherCard("UV Index", d.solar_and_uvi.uvi.value, "");
            
            metricsDiv.innerHTML = html;
            
            // Hide loader, show dashboard
            document.getElementById('weather-loader').style.display = 'none';
            document.getElementById('weather-dashboard').style.display = 'block';
        } else {
            document.getElementById('weather-loader').textContent = "ERROR: Failed to parse sensor data.";
            document.getElementById('weather-loader').style.color = "red";
            document.getElementById('weather-loader').classList.remove('blinking');
        }
    } catch (error) {
        document.getElementById('weather-loader').textContent = "ERROR: Connection to sensor array failed.";
        document.getElementById('weather-loader').style.color = "red";
        document.getElementById('weather-loader').classList.remove('blinking');
    }
}

// Data Visualization (Chart.js)


function getEcowittDateStr(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function fetchHistoricalData() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const endDateStr = encodeURIComponent(getEcowittDateStr(now));
    const startDateStr = encodeURIComponent(getEcowittDateStr(oneHourAgo));
    
    const HIST_URL = `https://api.ecowitt.net/api/v3/device/history?application_key=D55FDBC9235F9886E2D7715A7B0E8149&api_key=5f4fee86-c4b9-476b-8612-1746a5000029&mac=FC:F5:C4:BA:FE:CB&cycle_type=5min&start_date=${startDateStr}&end_date=${endDateStr}&call_back=outdoor.temperature,outdoor.humidity,wind.wind_speed,rainfall.daily&temp_unitid=1&wind_speed_unitid=7&rainfall_unitid=12`;

    try {
        const res = await fetch(HIST_URL);
        const json = await res.json();
        if (json.code === 0 && json.data) {
            updateRealChart(json.data);
            // Change note text
            document.querySelector('.sys-note').textContent = "* Showing REAL historical trends (Last 60 mins).";
        }
    } catch (e) {
        console.error("Failed to fetch historical data", e);
    }
}

function updateRealChart(data) {
    const ctx = document.getElementById('weatherChart').getContext('2d');
    
    // We assume all lists have the same keys (timestamps)
    const timestamps = Object.keys(data.outdoor.temperature.list).sort();
    
    const labels = timestamps.map(ts => {
        const d = new Date(parseInt(ts) * 1000);
        return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    const tempData = timestamps.map(ts => parseFloat(data.outdoor.temperature.list[ts] || 0));
    const humData = timestamps.map(ts => parseFloat(data.outdoor.humidity.list[ts] || 0));
    const windData = timestamps.map(ts => parseFloat(data.wind.wind_speed.list[ts] || 0));
    const rainData = timestamps.map(ts => parseFloat(data.rainfall.daily.list[ts] || 0));

    if (!weatherChart) {
        Chart.defaults.color = '#888';
        Chart.defaults.font.family = "'JetBrains Mono', monospace";
        
        weatherChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Temp (°C)',
                        data: tempData,
                        borderColor: '#ff003c',
                        backgroundColor: 'rgba(255, 0, 60, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Hum (%)',
                        data: humData,
                        borderColor: '#00ffff',
                        backgroundColor: 'rgba(0, 255, 255, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Wind (km/h)',
                        data: windData,
                        borderColor: '#00ff41',
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Rain (mm)',
                        data: rainData,
                        borderColor: '#0055ff',
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: '#333' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                    },
                    x: {
                        grid: { color: '#333' }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: '#ccc' }
                    }
                }
            }
        });
    } else {
        weatherChart.data.labels = labels;
        weatherChart.data.datasets[0].data = tempData;
        weatherChart.data.datasets[1].data = humData;
        weatherChart.data.datasets[2].data = windData;
        weatherChart.data.datasets[3].data = rainData;
        weatherChart.update();
    }
}


// Boot Sequence
const bootScreen = document.getElementById('boot-screen');
const bootText = document.getElementById('boot-text');

const bootSequence = [
    "Welcome to <span class='cyan'>Radetzky OS</span> 26.10 LTS (GNU/Linux 6.8.0-generic x86_64)",
    "",
    "[ <span class='neon-green'> OK </span> ] Reached target Local File Systems.",
    "[ <span class='neon-green'> OK </span> ] Started Tell Plymouth To Write Out Runtime Data.",
    "[ <span class='neon-green'> OK </span> ] Started Flush Journal to Persistent Storage.",
    "[ <span class='neon-green'> OK </span> ] Started Create Volatile Files and Directories.",
    "[ <span class='neon-green'> OK </span> ] Started Network Time Synchronization.",
    "[ <span class='neon-green'> OK </span> ] Reached target System Time Synchronized.",
    "[ <span class='neon-green'> OK </span> ] Started Update UTMP about System Boot/Shutdown.",
    "[ <span class='neon-green'> OK </span> ] Started D-Bus System Message Bus.",
    "[ <span class='cyan'>INFO</span> ] Starting Network Manager...",
    "[ <span class='neon-green'> OK </span> ] Started Network Manager.",
    "[ <span class='neon-green'> OK </span> ] Reached target Network.",
    "[ <span class='neon-green'> OK </span> ] Started Login Service.",
    "[ <span class='cyan'>PROCESS</span>] Connecting to Ecowitt Weather Array...",
    "[ <span class='neon-green'>SUCCESS</span>] Connection established.",
    "[ <span class='neon-green'> OK </span> ] Started Master Control Dashboard.",
    "[ <span class='neon-green'> OK </span> ] Reached target Graphical Interface.",
    "",
    "  _____           _      _       _          ",
    " |  __ \\         | |    | |     | |         ",
    " | |__) |__ _  __| | ___| |_ ___| | ___   _ ",
    " |  _  // _` |/ _` |/ _ \\ __|_  / |/ / | | |",
    " | | \\ \\ (_| | (_| |  __/ |_ / /|   <| |_| |",
    " |_|  \\_\\__,_|\\__,_|\\___|\\__/___|_|\\_\\\\__, |",
    "                                       __/ |",
    "                                      |___/ ",
    "",
    "radetzky login: _"
];

let bootIndex = 0;

function runBootSequence() {
    if (window.bootHalted) return;
    
    if (bootIndex < bootSequence.length) {
        let p = document.createElement('div');
        p.innerHTML = bootSequence[bootIndex];
        bootText.appendChild(p);
        
        bootIndex++;
        let delay = Math.random() * 30 + 10;
        
        if (bootSequence[bootIndex-1].includes("INFO") || bootSequence[bootIndex-1].includes("PROCESS")) {
            delay = 200;
        } else if (bootSequence[bootIndex-1].includes("radetzky login:")) {
            delay = 500;
        }

        setTimeout(runBootSequence, delay);
    } else {
        setTimeout(() => {
            bootScreen.style.opacity = '0';
            bootScreen.style.transition = 'opacity 0.4s ease-out';
            setTimeout(() => {
                bootScreen.style.display = 'none';
            }, 400);
        }, 300);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(runBootSequence, 200);
});

let weatherChart = null;



// Initialize FuzzyText component
document.addEventListener('DOMContentLoaded', () => {
    const fuzzyTarget = document.getElementById('fuzzy-text-target');
    if (fuzzyTarget && window.initFuzzyText) {
        window.initFuzzyText(fuzzyTarget, {
            text: 'Radetzky Máté',
            fontSize: 'clamp(2rem, 5vw, 2.5rem)',
            fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace',
            color: '#ffffff',
            enableHover: true,
            baseIntensity: 0.18,
            hoverIntensity: 0.5,
            fuzzRange: 20,
            fps: 60,
            direction: 'horizontal',
            transitionDuration: 0,
            clickEffect: false,
            glitchMode: true,
            glitchInterval: 2500,
            glitchDuration: 200,
            letterSpacing: 0,
            sliceSize: 1,
            trigger: 'hover',
            intro: true,
            introDuration: 1400,
            colorSplit: 0.3
        });
    }
});

