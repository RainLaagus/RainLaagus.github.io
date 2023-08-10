let skillsData = {};
let auditData = {};
let tasksData = {};
let firstName = "";
let lastName = "";
let startDate = "";
let totalXP = 0;

function getAllData(JWT) {
    const query = `
    {
        information: user {
          firstName
          lastName
          createdAt
          auditRatio
          totalUp
          totalDown
        }
        skills: transaction(
          where: {type: {_regex: "skill"}}
          order_by: {amount: desc}
        ) {
          amount
          type
        }
        tasks: transaction(
          where: {type: {_regex: "xp"}, path: {_nregex: "piscine"}}
          order_by: {createdAt: desc}
        ) {
          path
          amount
        }
      }
  `;

    fetch("https://01.kood.tech/api/graphql-engine/v1/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${JWT}`
        },
        body: JSON.stringify({ query: query })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            handleQueryData(data)
        })
        .catch(error => {
            console.error("Error:", error);
        });
}

function handleQueryData(data) {
    // Extract the maximum values for each skill type
    data.data.skills.forEach(function (transaction) {
        let skillType = transaction.type.replace(/^skill_/, '');
        let amount = transaction.amount;
        if (!skillsData[skillType] || amount > skillsData[skillType]) {
            skillsData[skillType] = amount;
        }
    });

    // Sum up audits done and received xp and calculate the audit ratio
    let information = data.data.information[0]
    let auditsDoneXp = information.totalUp;
    let auditsReceivedXp = information.totalDown;

    auditData = {
        totals: [{
            title: "Audits done",
            value: auditsDoneXp,
            all: auditsDoneXp + auditsReceivedXp
        },
        {
            title: "Audits received",
            value: auditsReceivedXp,
            all: auditsDoneXp + auditsReceivedXp
        }],
        auditRatio: Math.round(information.auditRatio * 100) / 100
    }

    // Extract all tasks info that are not a piscine tasks
    data.data.tasks.forEach(transaction => {
        const regex = /\/([^/]+)$/;
        tasksData[transaction.path.match(regex)[1]] = transaction.amount;
        totalXP += transaction.amount;
    });

    // Handle personal information
    firstName = information.firstName;
    lastName = information.lastName;
    let date = new Date(information.createdAt);
    const formattedDate = date.toLocaleString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
    });

    document.getElementById("name").innerHTML = "Welcome, " + firstName + " " + lastName + "!";
    document.getElementById("date").innerHTML = (`Your kood/Jõhvi journey started on ${formattedDate}`);
    document.getElementById("totalXP").innerHTML = (`Your total XP amount is ${totalXP} bytes`);

    updateCharts();
}

function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const credentials = `${username}:${password}`;
    const encodedCredentials = btoa(credentials);

    fetch("https://01.kood.tech/api/auth/signin", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${encodedCredentials}`
        },
    })
        .then(response => {
            if (!response.ok) {
                alert("Wrong credentials!");
                return;
            }
            return response.json();
        })
        .then(data => {
            if (data) {
                document.getElementById("loginForm").classList.add("hidden");
                document.getElementById("logout").classList.remove("hidden");
                document.getElementById("charts").classList.remove("hidden");
                getAllData(data);
            }
        })
        .catch(error => {
            console.error("Error:", error);
        });
}

function logout() {
    document.getElementById("loginForm").classList.remove("hidden")
    document.getElementById("logout").classList.add("hidden")
    document.getElementById("charts").classList.add("hidden")
    skillsData, auditData, tasksData = {};
    firstName, lastName, startDate = "";
    totalXP = 0;
    location.reload();
}

function updateCharts() {
    createSkillsChart();
    createAuditChart();
    createTasksChart();
}

document.getElementById("loginForm").addEventListener("submit", function (event) {
    event.preventDefault();
    login();
});

document.getElementById("logout").addEventListener("click", function (event) {
    event.preventDefault();
    logout();
});

document.getElementById("skillsButton").addEventListener("click", function () {
    showChart("skillChart");
});

document.getElementById("auditButton").addEventListener("click", function () {
    showChart("auditChart");
});

document.getElementById("tasksButton").addEventListener("click", function () {
    showChart("tasksChart");
});

window.addEventListener("resize", updateCharts);

// Function to show the selected chart and hide others
function showChart(chartId) {
    const charts = ["skillChart", "auditChart", "tasksChart"];

    charts.forEach(chart => {
        if (chart === chartId) {
            document.getElementById(chart).style.display = "block";
        } else {
            document.getElementById(chart).style.display = "none";
        }
    });
}

function createSkillsChart() {
    // Set up the chart dimensions
    let margin = { top: 100, right: 20, bottom: 60, left: 40 };
    d3.select("#skillChart").selectAll("*").remove();

    // Set up the chart dimensions based on the new window size
    let width = window.innerWidth - margin.left - margin.right;
    let height = window.innerHeight - margin.top - margin.bottom;
    let centerX = width / 2 + margin.left;
    let centerY = height / 2 + margin.top;
    // Create SVG element
    let svg = d3.select("#skillChart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + centerX + "," + centerY + ")");

    // Set up scales
    let skills = Object.keys(skillsData);
    let numSkills = skills.length;
    let angleSlice = Math.PI * 2 / numSkills;

    let maxValue = d3.max(Object.values(skillsData));
    let radiusScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, Math.min(width / 2, height / 2)]);

    // Define colors
    let colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Create axes
    let axes = skills.map(function (skill, index) {
        let angle = index * angleSlice;
        let x = radiusScale(maxValue) * Math.cos(angle - Math.PI / 2);
        let y = radiusScale(maxValue) * Math.sin(angle - Math.PI / 2);
        return { skill: skill, x: x, y: y };
    });

    svg.selectAll(".axis")
        .data(axes)
        .enter().append("g")
        .attr("class", "axis")
        .each(function (d) {
            d3.select(this).append("line")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", d.x)
                .attr("y2", d.y)
                .attr("stroke", "#ccc")
                .attr("stroke-width", 1);

            const labelX = d.x * 1.08; // Adjust label position
            const labelY = d.y * 1.08; // Adjust label position

            d3.select(this).append("text")
                .attr("x", labelX)
                .attr("y", labelY)
                .attr("text-anchor", "middle")
                .style("font-size", "14px")
                .text(d.skill);
        });

    // Draw percentage circles
    for (let i = 1; i <= 10; i++) {
        let percentage = i * 10;
        let radius = (percentage / 100) * radiusScale(maxValue);

        svg.append("circle")
            .attr("class", "percentage-circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", radius)
            .attr("fill", "none")
            .attr("stroke", "#ddd")
            .attr("stroke-width", 1);
    }

    // Draw data points and labels
    skills.forEach(function (skill, index) {
        let angle = index * angleSlice;
        let value = skillsData[skill];

        let x = radiusScale(value) * Math.cos(angle - Math.PI / 2);
        let y = radiusScale(value) * Math.sin(angle - Math.PI / 2);

        svg.append("circle")
            .attr("class", "radar-point")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 4)
            .attr("fill", colorScale(index));
    });
    svg.append("text")
        .attr("x", 0)
        .attr("y", - (height / 2) - margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("text-decoration", "underline")
        .text("Your Skill Progression");

}

function createAuditChart() {
    let margin = { top: 100, right: 20, bottom: 60, left: 40 };
    d3.select("#auditChart").selectAll("*").remove();

    // Set up the chart dimensions based on the new window size
    let width = window.innerWidth - margin.left - margin.right;
    let height = window.innerHeight - margin.top - margin.bottom;
    let radius = Math.min(width, height) / 2;
    let color = d3.scaleOrdinal(d3.schemeCategory10);
    let centerY = height / 2 + 50;

    // Create SVG element
    let svg = d3.select("#auditChart")
        .append("svg")
        .attr("width", width)
        .attr("height", height + 50)
        .append("g")
        .attr("transform", "translate(" + width / 2 + "," + centerY + ")"); // Adjust y-position

    let arc = d3.arc()
        .outerRadius(radius - 10)
        .innerRadius(0);

    let pie = d3.pie()
        .sort(null)
        .value(function (d) { return d.value; });

    let g = svg.selectAll(".arc")
        .data(pie(auditData.totals))
        .enter().append("g")
        .attr("class", "arc");

    g.append("path")
        .attr("d", arc)
        .style("fill", function (d) { return color(d.data.title); });

    g.append("text")
        .attr("transform", function (d) { return "translate(" + arc.centroid(d) + ")"; })
        .attr("dy", ".35em")
        .style("text-anchor", "middle")
        .text(function (d) { return d.data.title; })

    g.append("text")
        .attr("transform", function (d) { return "translate(" + arc.centroid(d) + ")"; })
        .attr("dy", "1.5em")
        .style("text-anchor", "middle")
        .text(function (d) { return d.data.value + " xp" });

    svg.append("text")
        .attr("x", 0)
        .attr("y", -height / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("text-decoration", "underline")
        .text("Your audit ratio is " + auditData.auditRatio);
}

function createTasksChart() {
    // Set up the dimensions and margins of the graph
    const margin = { top: 50, right: 70, bottom: 90, left: 70 };
    d3.select("#tasksChart").selectAll("*").remove();

    // Set up the chart dimensions based on the new window size
    let width = window.innerWidth - margin.left - margin.right;
    let height = window.innerHeight - margin.top - margin.bottom;

    // Append the svg object to the chart div
    const svg = d3.select("#tasksChart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    // Define color scale
    const color = d3.scaleLinear()
        .domain([0, d3.max(Object.values(tasksData))])
        .range(["#545885", "#0073e6"]); // Color gradient range

    // X axis
    const x = d3.scaleBand()
        .range([0, width])
        .domain(Object.keys(tasksData))
        .padding(0.2);
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", "end")
        .style("font-size", "12px")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

    // Y axis
    const y = d3.scaleLinear()
        .domain([0, d3.max(Object.values(tasksData))])
        .range([height, 0]);
    svg.append("g")
        .call(d3.axisLeft(y)
            .tickFormat(d => d / 1000 + " kB")
            .tickSize(-width)
        );

    // Bars
    svg.selectAll("mybar")
        .data(Object.entries(tasksData))
        .enter()
        .append("rect")
        .attr("x", d => x(d[0]))
        .attr("y", d => y(d[1]))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d[1]))
        .attr("fill", d => color(d[1]));

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("text-decoration", "underline")
        .text("XP received from tasks");
}