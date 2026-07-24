// ===========================
// GAME VARIABLES
// ===========================

let difficulty = "";
let score = 0;
let health = 100;
let packetsRouted = 0;
let targetPackets = 0;
let stackSize = 0;

let currentPacket = null;
let packetQueue = [];

let firewallActive = false;
let dynamicRoutingActive = false;
let trafficFreezeActive = false;

let stackOverflowCount = 0;
let gameRunning = false;

let eventsIntervalId = null;
let uptimeIntervalId = null;

let serverList = [];
let packetTypes = [];

let correctAttempts = 0;
let wrongAttempts = 0;
let uptimeSeconds = 0;

const packetDescriptions = {

    HTTP:"Standard web traffic",
    HTTPS:"Encrypted web traffic",
    DNS:"Domain name lookups",
    VoIP:"Voice call traffic",
    VIDEO:"Video streaming traffic",
    FTP:"File transfer traffic",
    SMTP:"Outgoing mail traffic",
    DHCP:"IP address assignment",
    SSH:"Remote admin access",
    DATABASE:"Database query traffic",
    MALWARE:"Malicious traffic - must be dropped"

};


// ===========================
// PACKET DESTINATIONS
// ===========================

let routingPolicy = {};


// ===========================
// BUTTONS
// ===========================

const easyBtn = document.getElementById("easy-btn");
const mediumBtn = document.getElementById("medium-btn");
const hardBtn = document.getElementById("hard-btn");

const instructionBtn = document.getElementById("instruction-btn");
const backBtn = document.getElementById("back-btn");
const playAgainBtn = document.getElementById("play-again-btn");
const mainMenuBtn = document.getElementById("main-menu-btn");


// ===========================
// MAIN MENU BUTTONS
// ===========================

easyBtn.onclick = () => startGame("Easy");
mediumBtn.onclick = () => startGame("Medium");
hardBtn.onclick = () => startGame("Hard");

instructionBtn.onclick = () => {

    document.getElementById("main-menu").classList.add("hidden");
    document.getElementById("instructions-page").classList.remove("hidden");

};

backBtn.onclick = () => {

    document.getElementById("instructions-page").classList.add("hidden");
    document.getElementById("main-menu").classList.remove("hidden");

};


let lastDifficulty = "Easy";


playAgainBtn.onclick = () => {

    document.getElementById("game-over").classList.add("hidden");

    startGame(lastDifficulty);

};


mainMenuBtn.onclick = () => {

    stopGame();

    document.getElementById("game-over").classList.add("hidden");
    document.getElementById("main-menu").classList.remove("hidden");

};


function stopGame(){

    gameRunning = false;

    if(eventsIntervalId){ clearInterval(eventsIntervalId); eventsIntervalId = null; }
    if(uptimeIntervalId){ clearInterval(uptimeIntervalId); uptimeIntervalId = null; }

}


// ===========================
// START GAME
// ===========================

function startGame(level){

    stopGame();

    difficulty = level;
    lastDifficulty = level;

    score = 0;
    health = 100;
    packetsRouted = 0;
    packetQueue = [];
    correctAttempts = 0;
    wrongAttempts = 0;
    uptimeSeconds = 0;
    healthLog = [];

    firewallActive = false;
    dynamicRoutingActive = false;
    trafficFreezeActive = false;
    firewallOnCooldown = false;
    routingOnCooldown = false;
    freezeOnCooldown = false;

    document.body.classList.remove("theme-easy","theme-medium","theme-hard");
    document.body.classList.add("theme-" + level.toLowerCase());

    document.getElementById("mode-badge").textContent = level.toUpperCase() + " MODE";

    setAbilityBadge("ability-firewall","READY");
    setAbilityBadge("ability-routing","READY");
    setAbilityBadge("ability-freeze","READY");

    document.getElementById("health-reason").innerHTML =
    `<p class="reason-title">No health changes yet</p>
    <p class="reason-detail">Network health will stay at 100% until a misroute or network event occurs. Details of every change will appear here.</p>`;

    document.getElementById("health-log").innerHTML = "";

    if(level === "Easy"){

        stackSize = 10;
        targetPackets = 50;

        serverList = ["Server A","Server B","Server C"];

        packetTypes = ["HTTP","DNS","VoIP","HTTPS","MALWARE"];

    }

    else if(level === "Medium"){

        stackSize = 6;
        targetPackets = 100;

        serverList = ["Server A","Server B","Server C","Server D"];

        packetTypes = [
            "HTTP","DNS","VoIP",
            "HTTPS","FTP",
            "SMTP","MALWARE"
        ];

    }

    else{

        stackSize = 3;
        targetPackets = 150;

        serverList = [
            "Server A",
            "Server B",
            "Server C",
            "Server D",
            "Server E"
        ];

        packetTypes = [

            "HTTP",
            "HTTPS",
            "DNS",
            "VoIP",
            "FTP",
            "SMTP",
            "DHCP",
            "SSH",
            "DATABASE",
            "VIDEO",
            "MALWARE"

        ];

    }

    createRoutingTable();

    createServers();

    fillQueue();

    updateUI();

    document.getElementById("main-menu").classList.add("hidden");
    document.getElementById("instructions-page").classList.add("hidden");
    document.getElementById("game-over").classList.add("hidden");
    document.getElementById("game-container").classList.remove("hidden");

    gameRunning = true;

    startRandomEvents();

    uptimeIntervalId = setInterval(()=>{

        if(!gameRunning) return;

        uptimeSeconds++;

        document.getElementById("uptime").textContent = uptimeSeconds + "s";

    }, 1000);

}


// ===========================
// ROUTING TABLE
// ===========================

function createRoutingTable(){

    routingPolicy = {

        HTTP:"Server A",
        HTTPS:"Server A",

        VoIP:"Server B",
        VIDEO:"Server B",

        DNS:"Server C",

        FTP:"Server D",
        SMTP:"Server D",

        DATABASE:"Server E",

        DHCP:"Server E",
        SSH:"Server E",

        MALWARE:"DROP BOX"

    };

    let table = document.getElementById("routing-table");

    table.innerHTML = "";

    for(let packet in routingPolicy){

        let row = document.createElement("tr");

        row.innerHTML =

        `<td>${packet}</td>
        <td>${routingPolicy[packet]}</td>
        <td>${packetDescriptions[packet] || "-"}</td>`;

        table.appendChild(row);

    }

}


// ===========================
// SERVERS
// ===========================

function createServers(){

    let serverDiv = document.getElementById("servers");

    serverDiv.innerHTML = "";

    serverList.forEach((server,index)=>{

        let box = document.createElement("div");

        box.className = "server";

        box.innerHTML =

        `<h3>${index+1}. ${server}</h3>
        <p class="online">ONLINE</p>`;

        serverDiv.appendChild(box);

    });

}


// ===========================
// PACKETS
// ===========================

function generatePacket(){

    return packetTypes[Math.floor(Math.random()*packetTypes.length)];

}


function fillQueue(){

    while(packetQueue.length < stackSize){

        packetQueue.push(generatePacket());

    }

    currentPacket = packetQueue[0];

}


// ===========================
// HEALTH REASON DISPLAY
// ===========================

let healthLog = [];

function formatClock(){

    let now = new Date();

    let h = String(now.getHours()).padStart(2,"0");
    let m = String(now.getMinutes()).padStart(2,"0");
    let s = String(now.getSeconds()).padStart(2,"0");

    return h + ":" + m + ":" + s;

}


function showHealthReason(title, detail, severity){

    let severityClass = "severity-" + severity.toLowerCase();

    document.getElementById("health-reason").innerHTML =
    `<p class="reason-title">${title} <span class="severity-tag ${severityClass}">${severity}</span></p>
    <p class="reason-detail">${detail}</p>`;

    healthLog.unshift({ time: formatClock(), title, detail, severityClass });

    if(healthLog.length > 8){

        healthLog.pop();

    }

    let logList = document.getElementById("health-log");

    logList.innerHTML = "";

    healthLog.forEach(entry=>{

        let item = document.createElement("li");

        item.className = "log-bad";

        item.innerHTML =
        `<span class="log-time">${entry.time}</span>
        <span class="severity-tag ${entry.severityClass}" style="margin-right:6px;">●</span>
        ${entry.title} — ${entry.detail}`;

        logList.appendChild(item);

    });

    updateMonitorStatus();

}


function updateMonitorStatus(){

    let safeHealth = Math.max(health, 0);

    document.getElementById("monitor-percent").textContent = safeHealth + "%";

    let statusEl = document.getElementById("monitor-status");

    statusEl.classList.remove("status-stable","status-degraded","status-critical");

    if(safeHealth <= 25){

        statusEl.textContent = "CRITICAL";
        statusEl.classList.add("status-critical");

    }

    else if(safeHealth <= 55){

        statusEl.textContent = "DEGRADED";
        statusEl.classList.add("status-degraded");

    }

    else{

        statusEl.textContent = "STABLE";
        statusEl.classList.add("status-stable");

    }

}


// ===========================
// UI UPDATE
// ===========================

function updateUI(){

    document.getElementById("difficulty").textContent = difficulty;

    document.getElementById("score").textContent = score;

    document.getElementById("health").textContent = Math.max(health,0) + "%";

    let healthBar = document.getElementById("health-bar-fill");

    let safeHealth = Math.max(health, 0);

    healthBar.style.width = safeHealth + "%";

    healthBar.classList.remove("warning","danger");

    if(safeHealth <= 25){

        healthBar.classList.add("danger");

    }

    else if(safeHealth <= 55){

        healthBar.classList.add("warning");

    }

    updateMonitorStatus();

    document.getElementById("routed").textContent = packetsRouted;

    let totalAttempts = correctAttempts + wrongAttempts;

    let accuracy = totalAttempts === 0
        ? 100
        : Math.round((correctAttempts / totalAttempts) * 100);

    document.getElementById("accuracy").textContent = accuracy + "%";

    document.getElementById("uptime").textContent = uptimeSeconds + "s";

    document.getElementById("target").textContent = targetPackets;

    document.getElementById("stack").textContent =
    packetQueue.length + "/" + stackSize;


    document.getElementById("current-packet").textContent =
    currentPacket;


    let destination =
    routingPolicy[currentPacket];

    document.getElementById("current-destination").textContent =
    "→ " + destination;



    document.querySelectorAll(".server").forEach(box=>{

        box.classList.remove("active-target");

    });

    if(destination !== "DROP BOX"){

        let serverIndex = serverList.indexOf(destination);

        let serverBoxes = document.querySelectorAll(".server");

        if(serverIndex > -1 && serverBoxes[serverIndex]){

            serverBoxes[serverIndex].classList.add("active-target");

        }

    }


    let list = document.getElementById("packet-stack");

    list.innerHTML = "";

    packetQueue.forEach(packet=>{

        let item = document.createElement("li");

        item.textContent = packet;

        list.appendChild(item);

    });

}


// ===========================
// ROUTE PACKET
// ===========================

function routePacket(choice){

    if(!gameRunning) return;


    let destination = routingPolicy[currentPacket];


    if(currentPacket === "MALWARE"){

        if(choice === 0){

            score += 15;
            correctAttempts++;

        }

        else{

            health -= 15;
            wrongAttempts++;

            showHealthReason(
                "Malware Breach",
                "A MALWARE packet slipped past you instead of going to the Drop Box. Undetected malicious traffic can spread across the network and undermines trust in every server it touches. This mistake cost 15% health.",
                "Severe"
            );

        }

    }

    else{

        let correctServer =
        serverList.indexOf(destination) + 1;


        if(choice === correctServer){

            score += 10;
            packetsRouted++;
            correctAttempts++;

        }

        else{

            health -= 10;
            wrongAttempts++;

            showHealthReason(
                "Routing Error",
                `A ${currentPacket} packet was sent to the wrong server. It should have been routed to ${destination}. Misrouted traffic wastes bandwidth and can overload the wrong service. This mistake cost 10% health.`,
                "Moderate"
            );

        }

    }


    packetQueue.shift();

    packetQueue.push(generatePacket());

    currentPacket = packetQueue[0];


    checkGameStatus();

    updateUI();

}


// ===========================
// KEYBOARD CONTROLS
// ===========================

document.addEventListener("keydown",(event)=>{


    if(!gameRunning) return;


    if(event.key === "1") routePacket(1);
    if(event.key === "2") routePacket(2);
    if(event.key === "3") routePacket(3);
    if(event.key === "4") routePacket(4);
    if(event.key === "5") routePacket(5);

    if(event.key === "0") routePacket(0);


    // Firewall

    if(event.key.toLowerCase() === "f"){

        activateFirewall();

    }

    // Dynamic Routing

    if(event.key.toLowerCase() === "r"){

        activateDynamicRouting();

    }

    // Traffic Freeze

    if(event.key.toLowerCase() === "t"){

        activateTrafficFreeze();

    }


});


// ===========================
// ABILITIES
// ===========================

let firewallOnCooldown = false;
let routingOnCooldown = false;
let freezeOnCooldown = false;

const ABILITY_DURATION = 5000;
const ABILITY_COOLDOWN = 10000;


function setAbilityBadge(rowId, state){

    let row = document.getElementById(rowId);

    let badge = row.querySelector(".ability-status");

    badge.classList.remove("active");

    if(state === "ACTIVE"){

        badge.textContent = "ACTIVE";
        badge.classList.add("active");

    }

    else if(state === "COOLDOWN"){

        badge.textContent = "COOLDOWN";

    }

    else{

        badge.textContent = "READY";

    }

}


function activateFirewall(){

    if(firewallOnCooldown) return;

    firewallActive = true;
    firewallOnCooldown = true;

    setAbilityBadge("ability-firewall","ACTIVE");

    document.getElementById("network-event").textContent =
    "Firewall Activated!";

    setTimeout(()=>{

        firewallActive = false;
        setAbilityBadge("ability-firewall","COOLDOWN");

        setTimeout(()=>{

            firewallOnCooldown = false;
            setAbilityBadge("ability-firewall","READY");

        }, ABILITY_COOLDOWN);

    }, ABILITY_DURATION);

}


function activateDynamicRouting(){

    if(routingOnCooldown) return;

    dynamicRoutingActive = true;
    routingOnCooldown = true;

    setAbilityBadge("ability-routing","ACTIVE");

    document.getElementById("network-event").textContent =
    "Dynamic Routing Activated!";

    setTimeout(()=>{

        dynamicRoutingActive = false;
        setAbilityBadge("ability-routing","COOLDOWN");

        setTimeout(()=>{

            routingOnCooldown = false;
            setAbilityBadge("ability-routing","READY");

        }, ABILITY_COOLDOWN);

    }, ABILITY_DURATION);

}


function activateTrafficFreeze(){

    if(freezeOnCooldown) return;

    trafficFreezeActive = true;
    freezeOnCooldown = true;

    setAbilityBadge("ability-freeze","ACTIVE");

    document.getElementById("network-event").textContent =
    "Traffic Freeze Activated!";

    setTimeout(()=>{

        trafficFreezeActive = false;
        setAbilityBadge("ability-freeze","COOLDOWN");

        setTimeout(()=>{

            freezeOnCooldown = false;
            setAbilityBadge("ability-freeze","READY");

        }, ABILITY_COOLDOWN);

    }, ABILITY_DURATION);

}


// ===========================
// RANDOM EVENTS
// ===========================

const events = [

    "Congestion",

    "DDoS Attack",

    "Bandwidth Reduction",

    "Packet Loss",

    "No Active Events"

];


function startRandomEvents(){

    eventsIntervalId = setInterval(()=>{

        if(!gameRunning) return;

        let randomEvent =
        events[Math.floor(Math.random()*events.length)];


        let eventEl = document.getElementById("network-event");

        eventEl.textContent = randomEvent;

        eventEl.classList.remove("event-neutral","event-bad");

        eventEl.classList.add(
            randomEvent === "No Active Events" ? "event-neutral" : "event-bad"
        );


        if(randomEvent === "Congestion"){

            health -= 5;

            showHealthReason(
                "Network Congestion",
                "Traffic volume has spiked well beyond normal capacity, causing queuing delays across every link. Sustained congestion like this slowly degrades network health if it isn't relieved. This event cost 5% health.",
                "Minor"
            );

        }

        else if(randomEvent === "DDoS Attack"){

            health -= 8;

            showHealthReason(
                "DDoS Attack",
                "A distributed denial-of-service attack is flooding the network with junk requests, straining server resources and crowding out legitimate traffic. Activating the Firewall ability can help absorb attacks like this. This event cost 8% health.",
                "Severe"
            );

        }

        else if(randomEvent === "Bandwidth Reduction"){

            health -= 3;

            showHealthReason(
                "Bandwidth Reduction",
                "Available bandwidth has been throttled, most likely due to an upstream link issue outside the network's control. Packets still need routing correctly to avoid compounding the slowdown. This event cost 3% health.",
                "Minor"
            );

        }

        else if(randomEvent === "Packet Loss"){

            health -= 2;

            showHealthReason(
                "Packet Loss",
                "Packets are being silently dropped in transit because of unstable links somewhere in the network. It's a small hit on its own, but frequent packet loss adds up quickly. This event cost 2% health.",
                "Minor"
            );

        }


        checkGameStatus();
        updateUI();


    },10000);

}



// ===========================
// GAME STATUS
// ===========================

function checkGameStatus(){


    if(health <= 0){

        loseGame();

    }


    if(packetsRouted >= targetPackets){

        winGame();

    }

}



function winGame(){

    stopGame();

    document.getElementById("game-container").classList.add("hidden");

    document.getElementById("game-over").classList.remove("hidden");

    document.getElementById("game-result").textContent =
    "MISSION SUCCESS";

    document.getElementById("final-score").textContent =
    "Final Score: " + score;

}



function loseGame(){

    stopGame();

    document.getElementById("game-container").classList.add("hidden");

    document.getElementById("game-over").classList.remove("hidden");

    document.getElementById("game-result").textContent =
    "NETWORK FAILURE";

    document.getElementById("final-score").textContent =
    "Final Score: " + score;

}