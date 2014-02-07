
bokeh = function() { // spans everything - not indented
var bokeh = {}

stopItNow = false

bokeh.init = function () {
	var svg = d3.select("#svg")
	var c = new Particle(350, 350, 60, 140, 133, 197, 0.6, 5)
	var c2 = new Particle(300, 300, 60, 140, 133, 197, 0.6, 5)
	
	var psys = new PSystem()
	
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
	[480, 200],[580, 400],[680, 100],[780, 300],[180, 300],[280, 100],[380, 400]
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










function Particle(x,y,r,h,l,s,a,g) {
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
	
	self.h = new Prop(h) // hue
	self.s = new Prop(s) // saturation
	self.l = new Prop(l) // lightness
	self.a = new Prop(a) // alpha
	
	self.g = new Prop(g) // gauss
	self.r = new Prop(r) // radius
	
	self.obj = circleFor(self)
	return self
}

function PSystem() {
	var self = this
	// goal means and variances
	var gMean = {h: 140, s: 180, a: 200, r: 50, g: 5}
	var gVar = {h: 10, s: 30, a: 30, r: 200, g: 2}
	var pls = [] // particle list
	var log = {}
	
	self.init = function() {
		pls.push(new Particle(650, 650, 60, 50, 133, 197, 0.6, 5))
		pls.push(new Particle(500, 650, 60, 100, 133, 197, 0.6, 5))
		pls.push(new Particle(650, 500, 60, 150, 133, 197, 0.6, 5))
		pls.push(new Particle(500, 500, 60, 180, 133, 197, 0.6, 5))
		
		log.items = [["h", "_"], ["h", "v"], ["h", "acc"]]
		
		for (var i=0; i<log.items.length; i++) {
			var e = log.items[i]
			var en = e[0]+" "+e[1]
			
			log["mean_"+en] = []
			log["var_"+en] = []

			log["chart_mean_"+en] = createChart(
				"mean "+en, e[1] === "_" ? gMean[en[0]] : undefined)
			log["chart_var_"+en] = createChart(
				"var "+en, e[1] === "_" ? gVar[en[0]] : undefined)
		}
		
		self.start()
	}
	
	log.updateLog = function() {
		for (var i=0; i<log.items.length; i++) {
			var e = log.items[i]
			var en = e[0]+" "+e[1]
			
			var mean_ = log["mean_"+en]
			var var_ = log["var_"+en]
			
			mean_.push(mean(plsList(e[0], e[1])))
			var_.push(variance(plsList(e[0], e[1])))
			
			log["chart_mean_"+en].updateChart(mean_)
			log["chart_var_"+en].updateChart(var_)
		}
	}
	
	self.start = function() {
		if (stopItNow)
			return
		
		var stepsTdelta = 30
		
		log.updateLog()
		step("h")
		step("g")
		
		for (var i=0; i<pls.length; i++) {
			pls[i].obj.feGaussianBlur.transition()
				.duration(stepsTdelta)
				.ease(d3.ease("linear"))
				.attr("stdDeviation", pls[i].g._)
			
			var t = pls[i].obj.transition()
				.duration(stepsTdelta)
				.ease(d3.ease("linear"))
				.style("fill", hsl255ToHex(pls[i].h._, pls[i].s._, pls[i].l._))
				
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
			particle[attr].activity = (Math.random()-0.5)/30
			particle[attr].activityRounds += Math.round(Math.random()*20)
		}
		
		for (var i=0; i<pls.length; i++) {
			var p = pls[i][attr]
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
			if (p.activityRounds > 0) {
				p.activityRounds--
				accDelta += p.activity
			}
			
			// accelerate to reach goal variance
			var d_mean = p._ - mean_
			var cor_var_sign = (var_ < gVar[attr] && d_mean > 0)
				|| (var_ > gVar[attr] && d_mean < 0) ? 1 : -1
			if (Math.abs(dVar) > 3
				&& ((cor_var_sign > 0 && mean_v <= 0)
				|| (cor_var_sign < 0 && mean_v >= 0)))
				accDelta += cor_var_sign * 0.01
			
			p.acc += accDelta
			
			// always dampen accelation & speed
			p.acc *= 0.90
			p.v += p.acc
			p.v *= 0.90
			p._ += p.v
			p._ = Math.max(0, p._)
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