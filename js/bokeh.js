
bokeh = function() { // spans everything - not indented
var bokeh = {}

stopItNow = false

bokeh.init = function () {
	var svg = d3.select("#svg")

	var psys = new PSystem()

	saveSVGshortcut()
}

function Particle(x,y,r,h,s,l,a,g) {
	var self = this
	
	function Prop(initial) {
//		this.parent = self
		var self = this
		self._ = initial // value
		
		self.v = 0 // velocity
		self.acc = 0 // acceleration
		self.activity = 0
		self.activityRounds = 0
	}
	
	self.x = new Prop(x)
	self.y = new Prop(y)
	self.r = new Prop(r) // radius
	
	self.h = new Prop(h) // hue
	self.s = new Prop(s) // saturation
	self.l = new Prop(l) // lightness
	self.a = new Prop(a) // alpha
	
	self.g = new Prop(g) // gauss
	
	self.obj = circleFor(self)
	return self
}

function PSystem() {
	var self = this
	// goal means and variances
	var gMean =	{x: 500, y: 400, r: 100, h: 140, s: 180, l: 200, a: 0.5, g: 20}
	var gVar =	{x: 100, y: 100, r: 50, h: 10, s: 30, l: 30, a: 0.2, g: 5}
	var numberOfParticles = 4
	var pls = [] // particle list
	var log = {}
	
	self.init = function() {
		function dr(attr) {
			return (gMean[attr]+(Math.random()-0.5)*gVar[attr])
		}
		
		for (var i=0; i<numberOfParticles; i++) {
			pls.push(new Particle(
				dr("x"),dr("y"),dr("r"),dr("h"),dr("s"),dr("l"),dr("a"),dr("g")))
		}
		
//		log.items = [["h", "_", "mean"], ["h", "v", "mean"], ["h", "acc", "mean"]]
//		log.items = [["h", "_", "mean"], ["g", "_", "mean"], ["r", "_", "mean"]]
		log.items = []
		
		for (var i=0; i<log.items.length; i++) {
			var e = log.items[i]
			var en = e[0]+"_"+e[1]+"_"+e[2]
			log[en] = []
			
			var orientation = undefined
			if (e[1] === "_")
				orientation = e[2] === "mean" ? gMean[e[0]] : gVar[e[0]]
			
			log["chart_"+en] = createChart(en, orientation)
		}
		
		self.start()
	}
	
	log.updateLog = function() {
		for (var i=0; i<log.items.length; i++) {
			var e = log.items[i]
			var en = e[0]+"_"+e[1]+"_"+e[2]
			var l = log[en]
			l.push(e[2] === "mean"
				? mean(plsList(e[0], e[1]))
				: variance(plsList(e[0], e[1])))
			log["chart_"+en].updateChart(l)
		}
	}
	
	self.start = function() {
		if (stopItNow)
			return
		
		var stepsTdelta = 30
		
		log.updateLog()
		step("h")
		step("g")
		step("r")
		step("a")
		step("x")
		step("y")
		
		for (var i=0; i<pls.length; i++) {
			var p = pls[i]
			p.obj.feGaussianBlur.transition()
				.duration(stepsTdelta)
				.ease(d3.ease("linear"))
				.attr("stdDeviation", p.g._)
			
			var t = p.obj.transition()
				.duration(stepsTdelta)
				.ease(d3.ease("linear"))
				.style("fill", hsl255ToHex(p.h._, p.s._, p.l._))
				// todo number rounding
				.style("fill-opacity", p.a._)
				.attr("r", p.r._)
				.attr("transform", "translate("+p.x._+", "+p.y._+")")
			
			if (i === pls.length-1)
				t.each("end", self.start)
		}
	}
	
	var step = function(attr) {
		var mean_ = mean(plsList(attr))
		var var_ = variance(plsList(attr))
		var mean_v = mean(plsList(attr, "v"))
		
		if (Math.random() < 0.1) {
			var particle = pls[Math.round(Math.random()*(pls.length-1))]
			particle[attr].activity = (Math.random()-0.5)/300*gVar[attr]
			particle[attr].activityRounds += Math.round(Math.random()*20)
		}
		
		for (var i=0; i<pls.length; i++) {
			var pa = pls[i][attr]
			var dMean = gMean[attr] - mean_
			var dVar = gVar[attr] - var_
			
			// linear prediction
			// steps it takes @ current v to reach g_mean_h
			var prediction = mean_v === 0 ? 1000 : dMean/mean_v
			// the less steps to go, the more I dampen acceleration
			// below this number, accDelta is 0, increasing above, to *1 (max)
			var predDampen = 20
			// the max
			var accDeltaAbs = 0.03
			if (Math.abs(dMean) < 10)
				accDeltaAbs *= Math.abs(dMean)/10
			if (prediction >= 0 && prediction <= predDampen)
				accDeltaAbs = 0
			if (prediction > predDampen)
				accDeltaAbs *= 1-predDampen/prediction
			
			var accDelta = (dMean < 0 ? -1 : 1) * accDeltaAbs
			if (pa.activityRounds > 0) {
				pa.activityRounds--
				accDelta += pa.activity
			}
			
			// accelerate to reach goal variance
			var d_mean = pa._ - mean_
			var cor_var_sign = (var_ < gVar[attr] && d_mean > 0)
				|| (var_ > gVar[attr] && d_mean < 0) ? 1 : -1
			if (Math.abs(dVar) > 3
				&& ((cor_var_sign > 0 && mean_v <= 0)
				|| (cor_var_sign < 0 && mean_v >= 0)))
				accDelta += cor_var_sign * 0.01
			
			pa.acc += accDelta
			
			// always dampen accelation & speed
			pa.acc *= 0.90
			pa.v += pa.acc
			pa.v *= 0.90
			pa._ += pa.v
			pa._ = Math.max(0, pa._)
		}
	}
	
	
	var plsList = function(property, attribute) {
		var list = []
		if (attribute === undefined)
			attribute = "_"
		for (var i=0; i<pls.length; i++)
			list.push(pls[i][property][attribute])
		return list
	}
	
	var variance = function(list) {
		var m = mean(list)
		var z = []
		for (var i=0; i<list.length; i++)
			z.push(Math.abs(list[i] - m)) // instead of a²
		return mean(z)
	}
	
	var mean = function(list) {
		return sum(list)/list.length
	}
	
	var sum = function(list) {
		var sum = 0
		for (var i=0; i<list.length; i++)
			sum += list[i]
		return sum
	}
	
	self.init()
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

function circleFor(p) { // particle
	return circleSimple(p.x._, p.y._, p.r._, p.h._, p.s._, p.l._, p.a._, p.g._)
}

function circleSimple(x, y, r, h, s, l, a, g) {
	var filterName = Math.random().toString(36).substring(7)
	var feGaussianBlur = d3.select("#svg defs")
		.append("filter")
		.attr("id", filterName)
		.attr("x", -3)
		.attr("y", -3)
		.attr("width", 8)
		.attr("height", 8)
		.append("feGaussianBlur")
		.attr("stdDeviation", g)
	
	var c = d3.select("#svg").append("circle")
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
			"filter": "url(#"+filterName+")"
		})
	c.feGaussianBlur = feGaussianBlur
	return c
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