function getSkillData(JWT) {
    const skillsQuery = `
    query {
        transaction(
            where: {
            type: {_regex: "skill"}
            },
            order_by: {amount: desc},
            limit: 50,
        ) {
            amount
            type
        }
    }
  `;

    fetch("https://01.kood.tech/api/graphql-engine/v1/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${JWT}`
        },
        body: JSON.stringify({ query: skillsQuery })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            createSkillsChart(data)
        })
        .catch(error => {
            console.error("Error:", error);
        });
}

function getAuditData(JWT) {
    const auditQuery = `
    {
        transaction(where: { type: { _in: ["up", "down"] } }) {
          amount
          type
        }
      }
  `;

    fetch("https://01.kood.tech/api/graphql-engine/v1/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${JWT}`
        },
        body: JSON.stringify({ query: auditQuery })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            createAuditChart(data)
        })
        .catch(error => {
            console.error("Error:", error);
        });
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
                document.getElementById("loginForm").classList.add("hidden")
                document.getElementById("logout").classList.remove("hidden")
                getSkillData(data)
                getAuditData(data)
            }
        })
        .catch(error => {
            console.error("Error:", error);
        });
}

function logout() {
    document.getElementById("loginForm").classList.remove("hidden")
    document.getElementById("logout").classList.add("hidden")
    location.reload();
}

document.getElementById("loginForm").addEventListener("submit", function (event) {
    event.preventDefault();
    login();
});

document.getElementById("logout").addEventListener("click", function (event) {
    event.preventDefault();
    logout();
});

function createSkillsChart(data) {
    // Extract the maximum values for each skill type
    var skillMaxValues = {};
    data.data.transaction.forEach(function (transaction) {
        var skillType = transaction.type;
        var amount = transaction.amount;
        if (!skillMaxValues[skillType] || amount > skillMaxValues[skillType]) {
            skillMaxValues[skillType] = amount;
        }
    });

    // Set up the chart dimensions
    var margin = { top: 100, right: 20, bottom: 60, left: 40 };
    var width = 800 - margin.left - margin.right;
    var height = 400 - margin.top - margin.bottom;
    var centerX = width / 2 + margin.left;
    var centerY = height / 2 + margin.top;

    // Create SVG element
    var svg = d3.select("#skillChart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + centerX + "," + centerY + ")");

    // Set up scales
    var skills = Object.keys(skillMaxValues);
    var numSkills = skills.length;
    var angleSlice = Math.PI * 2 / numSkills;

    var maxValue = d3.max(Object.values(skillMaxValues));
    var radiusScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, Math.min(width / 2, height / 2)]);

    // Define colors
    var colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Create axes
    var axes = skills.map(function (skill, index) {
        var angle = index * angleSlice;
        var x = radiusScale(maxValue) * Math.cos(angle - Math.PI / 2);
        var y = radiusScale(maxValue) * Math.sin(angle - Math.PI / 2);
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

            d3.select(this).append("text")
                .attr("x", d.x * 1.25) // Adjust label position
                .attr("y", d.y * 1.25) // Adjust label position
                .attr("text-anchor", "middle")
                .style("font-size", "14px")
                .text(d.skill);
        });

    // Draw percentage circles
    for (var i = 1; i <= 10; i++) {
        var percentage = i * 10;
        var radius = (percentage / 100) * radiusScale(maxValue);

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
        var angle = index * angleSlice;
        var value = skillMaxValues[skill];

        var x = radiusScale(value) * Math.cos(angle - Math.PI / 2);
        var y = radiusScale(value) * Math.sin(angle - Math.PI / 2);

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




function createAuditChart(data) {

    const transactions = data.data.transaction;

    let upTotal = 0;
    let downTotal = 0;
    let auditRatio = 0;

    transactions.forEach(transaction => {
        const type = transaction.type;

        if (type === "up") {
            upTotal += transaction.amount;
        } else if (type === "down") {
            downTotal += transaction.amount;
        }
    });

    auditRatio = Math.round(upTotal / downTotal * 100) / 100

    console.log(`Total "up" transactions: ${upTotal}`);
    console.log(`Total "down" transactions: ${downTotal}`);
    console.log(`ratio: ${auditRatio}`);

    var totals = [{
        title: "Audits done",
        value: upTotal,
        all: upTotal + downTotal
    },
    {
        title: "Audits received",
        value: downTotal,
        all: upTotal + downTotal
    }];

    var width = 400;
    var height = 400;
    var radius = Math.min(width, height) / 2;

    var color = d3.scaleOrdinal(d3.schemeCategory10);
    var centerY = height / 2 + 50; // Add 50 for the title

    // Create SVG element
    var svg = d3.select("#auditChart")
        .append("svg")
        .attr("width", width)
        .attr("height", height + 50) // Add 50 for the title
        .append("g")
        .attr("transform", "translate(" + width / 2 + "," + centerY + ")"); // Adjust y-position

    var arc = d3.arc()
        .outerRadius(radius - 10)
        .innerRadius(0);

    var pie = d3.pie()
        .sort(null)
        .value(function (d) { return d.value; });

    var g = svg.selectAll(".arc")
        .data(pie(totals))
        .enter().append("g")
        .attr("class", "arc");

    g.append("path")
        .attr("d", arc)
        .style("fill", function (d) { return color(d.data.title); });

    g.append("text")
        .attr("transform", function (d) { return "translate(" + arc.centroid(d) + ")"; })
        .attr("dy", ".35em")
        .style("text-anchor", "middle")
        .text(function (d) { return d.data.title; });
    svg.append("text")
        .attr("x", 0)
        .attr("y", -height / 2 - 10)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("text-decoration", "underline")
        .text("Your audit ratio is " + auditRatio);

}
