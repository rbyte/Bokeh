
bokeh = function() { // spans everything - not indented
var bokeh = {}

stopItNow = false

bokeh.init = function () {
	var svg = d3.select("#svg")
	
	var c = new Particle(svg, 350, 350, 60, 140, 133, 197, 0.6, 5)
	var c2 = new Particle(svg, 300, 300, 60, 140, 133, 197, 0.6, 5)
	
	var psys = new PSystem()
	psys.addParticle(new Particle(svg, 650, 650, 60, 50, 133, 197, 0.6, 5))
	psys.addParticle(new Particle(svg, 500, 650, 60, 100, 133, 197, 0.6, 5))
	psys.addParticle(new Particle(svg, 650, 500, 60, 150, 133, 197, 0.6, 5))
	psys.addParticle(new Particle(svg, 500, 500, 60, 180, 133, 197, 0.6, 5))
	psys.start()
	
//	if (false)
	d3.select("#feGaussianBlur3765")
		.transition()
		.duration(5000)
		.attr("stdDeviation", 10)
	
	c.obj
		.transition()
		.duration(5000)
		.style("fill", hsl255ToHex(140, 133, 255))
		.attr("transform", "translate("+250+", "+650+")") //  scale("+2+")
		.attr("r", "120")
	
	saveSVGshortcut()
	
	// http://bl.ocks.org/mbostock/1705868
	
var points = [
[480, 200],
[580, 400],
[680, 100],
[780, 300],
[180, 300],
[280, 100],
[380, 400]
]

var path = svg.append("path")
	.data([points])
	.attr("d", d3.svg.line()
		.tension(0) // Catmull–Rom
		.interpolate("cardinal-closed"))
//	.style({
//		"fill": "none",
//		"stroke": hsl255ToHex(140, 133, 255),
//		"stroke-opacity": 1,
//		"stroke-width": "3px"
//	})
if (false)
transition()

function transition() {
	c2.obj.transition()
		.duration(10000)
		.ease(d3.ease("linear"))
//		.style("fill", "#ff0000")
		.styleTween("fill", rainbow)
		.attrTween("transform", translateAlong(path.node()))
		.each("end", transition)
}

// Returns an attrTween for translating along the specified path element.
function translateAlong(path) {
	var l = path.getTotalLength()
	return function(d, i, a) {
		return function(t) { // is an interpolator, t is in [0,1]
			var p = path.getPointAtLength(t * l)
			return "translate(" + p.x + "," + p.y + ")"
		}
	}
}

function rainbow(d, i, a) {
	return function(t) {
		return hsl255ToHex(t*255, 255, 125)
	}
}








}





function createChart(name, orientationBaseline) {
	var self = {}
	
	var margin = {top: 10, right: 20, bottom: 30, left: 50},
		width = 960 - margin.left - margin.right,
		height = 200 - margin.top - margin.bottom
	
	var svgPlot = d3.select("body").append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
	  .append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
	
	var x = d3.scale.linear().range([0, width])
	var y = d3.scale.linear().range([height, 0])

	var xAxis = d3.svg.axis().scale(x).orient("bottom")
	var yAxis = d3.svg.axis().scale(y).orient("left")
	
	var line = d3.svg.line()
		.x(function(d,i) { return x(i) })
		.y(function(d) { return y(d) })

	var xg = svgPlot.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + height + ")")
	
	var yg = svgPlot.append("g")
		.attr("class", "y axis")
	
    yg.append("text")
      .attr("x", 6)
      .attr("dy", ".71em")
      .text(name)
	
	var pathG = svgPlot.append("path")
	var pathOrientationHorizontal = svgPlot.append("path")
	
	self.updateChart = function(data) {
		x.domain([0, data.length-1])
		y.domain(d3.extent(data))

		xg.call(xAxis)
		yg.call(yAxis)

		pathG.remove()
		pathG = svgPlot.append("path")
			.datum(data)
			.attr("class", "line")
			.attr("d", line)
			
		x.domain([0, 1])
		
		if (orientationBaseline !== undefined) {
			pathOrientationHorizontal.remove()
			pathOrientationHorizontal = svgPlot.append("path")
				.datum([orientationBaseline, orientationBaseline])
				.attr("class", "line")
				.attr("d", line)
		}
	}
		
	return self
}


function circleSimple(svg, x, y, r, h, s, l, a) {
	var c = svg.append("circle")
		.attr("cx", 0)
		.attr("cy", 0)
		.attr("r", r)
//		.attr("fill", "url(#rg2)")
		.attr("transform", "translate("+x+", "+y+")") //  scale("+1+")
		.style({
			"fill": hsl255ToHex(h, s, l),
			"fill-opacity": a,
//			"stroke": hsl255ToHex(140, 133, 228),
//			"stroke-opacity": 1,
//			"stroke-width": 1.5,
			"filter": "url(#filter3763)"
		})
	return c
}




function Particle(svg,x,y,r,h,l,s,a,g) {
	var self = this
	
	self.x = x
	self.y = y
	
	// hue lightness saturation alpha
	self.h = h
	self.l = l
	self.s = s
	self.a = a
	
	self.g = g // gauss
	self.r = r // radius
	
	self.v = 0
	self.acc = 0
	self.activity = 0
	self.activityRounds = 0
	
	self.obj = circleSimple(svg,x,y,r,h,s,l,a)
	
}

function PSystem() {
	var self = this
	
	// goal averages/means
	var g_mean_numberOfParticles = 10
	var g_mean_h = 140 // 124 - 183 sind so schmerzgrenzen
	var g_mean_s = 180
	// the higher layers (z-index) are always brigther (!)
	// feBlend screen may be an alternative
	var base_l = 90
	var g_mean_a = 200
	
	// rather smaller for upper layers
	// could also scale with transform, but this also has downsides
	var g_mean_r = 50
	// rather higher for higher radius
	var g_mean_g = 30
	
	// goal variance
	var g_var_numberOfParticles
	var g_var_h = 10
	var g_var_s = 30
//	var g_var_l 
	var g_var_a = 30
	
	var g_var_r = 200
	var g_var_g = 30
	
	var pls = [] // particle list
	
	var log = {}
	log.items = ["h", "v", "acc"]
	
	for (var i=0; i<log.items.length; i++) {
		log["mean_"+log.items[i]] = []
		log["var_"+log.items[i]] = []
		
		log["chart_mean_"+log.items[i]] = createChart(
			"mean "+log.items[i], log.items[i] === "h" ? g_mean_h : undefined) // eval("g_mean_"+log.items[i])
		log["chart_var_"+log.items[i]] = createChart(
			"var "+log.items[i], log.items[i] === "h" ? g_var_h : undefined)
	}
	
	log.updateLog = function() {
		for (var i=0; i<log.items.length; i++) {
			var mean_ = log["mean_"+log.items[i]]
			var var_ = log["var_"+log.items[i]]
			
			mean_.push(self.mean(pls, log.items[i]))
			var_.push(self.variance(pls, log.items[i]))
			
			log["chart_mean_"+log.items[i]].updateChart(mean_)
			log["chart_var_"+log.items[i]].updateChart(var_)
		}
	}
	
	self.start = function() {
		if (stopItNow)
			return
		
		log.updateLog()
		var mean_h = self.mean(pls, "h")
		var var_h = self.variance(pls, "h")
		var mean_v = self.mean(pls, "v")
		
		if (Math.random() < 0.1) {
			var particle = pls[Math.round(Math.random()*(pls.length-1))]
			particle.activity = (Math.random()-0.5)/30
			particle.activityRounds += Math.round(Math.random()*20)
		}
		
		for (var i=0; i<pls.length; i++) {
			var d_all_mean_h = g_mean_h - mean_h
			var d_all_var_h = g_var_h - var_h
			
			
			// linear prediction
			// steps it takes @ current v to reach g_mean_h
			var prediction = mean_v === 0 ? 1000 : d_all_mean_h/mean_v
			// the less steps to go, the more I dampen acceleration
			// below this number, accDelta is 0, increasing above, to *1 (max)
			var predDampen = 20
			// the max
			var accDeltaAbs = 0.03
			if (Math.abs(d_all_mean_h) < 10)
				accDeltaAbs *= Math.abs(d_all_mean_h)/10
			if (prediction >= 0 && prediction <= predDampen)
				accDeltaAbs = 0
			if (prediction > predDampen)
				accDeltaAbs *= 1-predDampen/prediction
			
			var accDelta = (d_all_mean_h < 0 ? -1 : 1) * accDeltaAbs
			if (pls[i].activityRounds > 0) {
				pls[i].activityRounds--
				accDelta += pls[i].activity
			}
			
			// accelerate to reach goal variance
			var d_mean = pls[i].h - mean_h
			var cor_var_sign = (var_h < g_var_h && d_mean > 0)
				|| (var_h > g_var_h && d_mean < 0) ? 1 : -1
			if (Math.abs(d_all_var_h) > 3
				&& ((cor_var_sign > 0 && mean_v <= 0)
				|| (cor_var_sign < 0 && mean_v >= 0)))
				accDelta += cor_var_sign * 0.01
			
			pls[i].acc += accDelta
			
			// always dampen accelation & speed
			pls[i].acc *= 0.90
			pls[i].v += pls[i].acc
			pls[i].v *= 0.90
			pls[i].h += pls[i].v
			
			pls[i].obj.transition()
				.duration(30)
				.ease(d3.ease("linear"))
				.style("fill", hsl255ToHex(pls[i].h, pls[i].s, pls[i].l))
				.each("end", i === pls.length -1 ? self.start : function() {})
		}
		
	}
	
	self.addParticle = function(particle) {
		pls.push(particle)
	}
	
	self.variance = function(list, property) {
		var mean = self.mean(list, property)
		var newVals = []
		for (var i=0; i<list.length; i++) {
			var a = (property !== undefined ? list[i][property] : list[i]) - mean
			newVals.push(Math.abs(a)) // instead of a²
		}
		return self.mean(newVals)
	}
	
	self.mean = function(list, property) {
		return self.sum(list, property)/list.length
	}
	
	self.sum = function(list, property) {
		var sum = 0
		for (var i=0; i<list.length; i++) {
			sum += property !== undefined ? list[i][property] : list[i]
		}
		return sum
	}
	
}













function saveSVGshortcut() {
	function openSVG() {
		window.open("data:image/svg+xml," + encodeURIComponent(
			document.getElementById("svgWrapper").innerHTML
		))
	}

	document.addEventListener("keydown", function (evt) {
		switch(evt.keyCode) {
			case 83: openSVG(); break // s
			case 69: stopItNow = true; break // 7
		}
	}, false)
}



function hsl255ToHex(h, s, l) {
	return hslToHex(h/255, s/255, l/255)
}

function hslToHex(h, s, l) {
	return rgbToHex(hslToRgb(h, s, l))
}

function componentToHex(c) {
    var hex = c.toString(16)
    return hex.length == 1 ? "0" + hex : hex
}

function rgbToHex(rgb) {
    return "#"
		+ componentToHex(rgb.r)
		+ componentToHex(rgb.g)
		+ componentToHex(rgb.b)
}

// h, s, l in [0,1]
function hslToRgb(h, s, l) {
    var r, g, b
	
    if (s === 0 || l === 1 || l === 0) {
        r = g = b = l // achromatic
    } else {
        function hue2rgb(p, q, t){
            if (t < 0) t += 1
            if (t > 1) t -= 1
            if (t < 1/6) return p + (q - p) * 6 * t
            if (t < 1/2) return q
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
            return p
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s
        var p = 2 * l - q
        r = hue2rgb(p, q, h + 1/3)
        g = hue2rgb(p, q, h)
        b = hue2rgb(p, q, h - 1/3)
    }

    return {
		r: Math.round(r * 255),
		g: Math.round(g * 255),
		b: Math.round(b * 255)
	}
}


return bokeh
}()