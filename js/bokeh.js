
bokeh = function() { // spans everything - not indented
var bokeh = {}

pauseStepping = false
var svgWidth = 400
var svgHeight = 300
var psys

bokeh.init = function () {
	var svg = d3.select("#svg")
//	svg.attr("width", svgWidth)
//	svg.attr("height", svgHeight)
	svg.attr("viewBox", "0 0 "+svgWidth+" "+svgHeight)
	
	svg.append("rect")
		.attr("x", 0)
		.attr("y", 0)
		.attr("width", "100%")
		.attr("height", "100%")
		.style("fill", d3.hsl(151/255*360, 77/255, 111/255) )
	
	setUpKShortcuts()
	psys = new ParticleSystem()
	// in chrome, the svg viewbox aspect is not honored. the svg is stretched to
	// width and height 100% of the parent and "overflow" is visible
	// surround viewbox with white rectangles
	svg.append("rect").attr("x", "100%").attr("y", "-100%").attr("width", "100%").attr("height", "300%").style("fill", "#fff" )
	svg.append("rect").attr("x", "-100%").attr("y", "-100%").attr("width", "100%").attr("height", "300%").style("fill", "#fff" )
	svg.append("rect").attr("x", "0%").attr("y", "-100%").attr("width", "100%").attr("height", "100%").style("fill", "#fff" )
	svg.append("rect").attr("x", "0%").attr("y", "100%").attr("width", "100%").attr("height", "100%").style("fill", "#fff" )
	
}

function ParticleSystem() {
	var self = this
	var properties = ["x","y","r","h","s","l","a","g"]
	var gMean =	{h: 140,	s: 180,	l: 180,	a: .20,	g: svgWidth*.04,	x: svgWidth*.5,		y: svgHeight*.5,	r: svgWidth*.15}
	var gVar =	{h: 10,		s: 10,	l: 40,	a: .10,	g: svgWidth*.025,	x: svgWidth*.22,	y: svgHeight*.22,	r: svgWidth*.07}
	var gMin =	{h: 0,		s: 0,	l: 0,	a: 0,	g: svgWidth*.002,	x: svgWidth*-.20,	y: svgHeight*-.20,	r: svgWidth*0}
	var gMax =	{h: 255,	s: 255,	l: 255,	a: .8,	g: svgWidth*.1,		x: svgWidth*1.20,	y: svgHeight*1.20,	r: svgWidth*1}
	var actF =	{h: 1,		s: 1,	l: 1,	a: 1,	g: 1, x: 1, y: 1, r: 0.5}
	// TODO if true, circles do not show in inkscape
	var disableBlur = false
	if (disableBlur) {
		gMean.g = 0
		gVar.g = 0
	}
	var numberOfParticles = 20
	var kissenSize = 0.02 // [0, 0.5]
	var activityFactor = 1/2000
	var activityRoundsMax = 150
	var accDeltaAbsMax = 0.02
	var triggerActivityPropability = 0.05 // influenced by number of particles
	var predDampen = 20
	var stepsTdelta = 1
	
	var pls = [] // particle list
	var log = {}
	
	function Particle(pNo) {
		var p = this
		p.pNo = pNo
		for (var i=0; i<properties.length; i++) {
			p[properties[i]] = {
				_: gMean[properties[i]]+((Math.random()-0.5)*3)*gVar[properties[i]],
				v: 0, // velocity
				acc: 0, // acceleration
				activity: 0,
				activityRounds: 0,
				log: {_: [], v: [], acc: []}
			}
		}
		
		p.obj = circleSimple(p.x._, p.y._, p.r._, p.h._, p.s._, p.l._, p.a._, p.g._)
		return p
	}
	
	self.init = function() {
		for (var i=0; i<numberOfParticles; i++) {
			var p = new Particle(i)
			pls.push(p)
			// particle in front are brighter
			var lvar = gVar.l/255
			p.l._ *= ((1-lvar)+i/numberOfParticles*(lvar*2))
		}
//		log.items = [["r", "_", "mean"], ["g", "_", "mean"]]
//		log.items = [["g", "_", "mean"], ["r", "_", "mean"],
//			["a", "_", "mean"], ["x", "_", "mean"], ["y", "_", "mean"]]
		log.items = []
		log.init()
		self.start()
	}
	
	self.start = function() {
		if (pauseStepping)
			return
		
		for (var i=0; i<properties.length; i++)
			// lightness is bound to z-index
			if (properties[i] !== "l" && (!disableBlur || properties[i] !== "g"))
				step(properties[i])
		
		// additional constrains
		for (var i=0; i<pls.length; i++) {
			// increasing radius decreases opacity and increases blur
			var rAct = pls[i].r.activity
			if (rAct > 0 && pls[i].r.activityRounds > 0) {
				pls[i].a.acc -= rAct*activityFactor*gVar.a/10
				pls[i].g.acc += rAct*activityFactor*gVar.g
			}
			// increasing sharpness decreases opacity
			var gAct = pls[i].g.activity
			if (gAct < 0 && pls[i].g.activityRounds > 0) {
				pls[i].a.acc -= gAct*activityFactor*gVar.a/10
			}
		}
		
		log.updateLog()
		
		for (var i=0; i<pls.length; i++) {
			var p = pls[i]
			p.obj.feGaussianBlur
				.transition()
				.duration(stepsTdelta)
				.ease(d3.ease("linear"))
				.attr("stdDeviation", p.g._)
			
			var t = p.obj
				.transition()
				.duration(stepsTdelta)
				.ease(d3.ease("linear"))
				.style("fill", d3.hsl(p.h._/255*360, p.s._/255, p.l._/255) )
				.style("fill-opacity", p.a._)
				.attr("r", p.r._)
				.attr("transform", "translate("+p.x._+", "+p.y._+")")
			
			if (i === pls.length-1)
				t.each("end", self.start)
		}
		
//		setTimeout(self.start, stepsTdelta)
	}
	
	var step = function(attr) {
		var mean_ = mean(plsList(attr))
		var var_ = variance(plsList(attr))
		var mean_v = mean(plsList(attr, "v"))
		
		if (Math.random() < triggerActivityPropability) {
			var p = pls[Math.round(Math.random()*(pls.length-1))]
			
			p[attr].activity = Math.random()-0.5
			p[attr].activityRounds += Math.round(Math.random()*activityRoundsMax)
			// couple movements
			if (attr === "x" || attr === "y")
				p[attr === "x" ? "y" : "x"].activityRounds += Math.round(Math.random()*activityRoundsMax)
			// the closest circles (z-index) should have a small radius
			if (attr === "r")
				p[attr].activity += p.pNo/numberOfParticles/3
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
			
			// the max
			var accDeltaAbs = accDeltaAbsMax
			if (Math.abs(dMean) < 10)
				accDeltaAbs *= Math.abs(dMean)/10
			if (prediction >= 0 && prediction <= predDampen)
				accDeltaAbs = 0
			if (prediction > predDampen)
				accDeltaAbs *= 1-predDampen/prediction
			
			var accDelta = (dMean < 0 ? -1 : 1) * accDeltaAbs
			if (pa.activityRounds > 0) {
				pa.activityRounds--
				accDelta += pa.activity*activityFactor*actF[attr]*gVar[attr]
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
			
			// pressure into min max bounds
			var kissen = (gMax[attr]-gMin[attr])*kissenSize
			var intoMinKissen = (pa._ - gMin[attr]) / kissen
			if (intoMinKissen < 1 && pa.v < 0)
				pa.v *= intoMinKissen
			var intoMaxKissen = (gMax[attr] - pa._) / kissen
			if (intoMaxKissen < 1 && pa.v > 0)
				pa.v *= intoMaxKissen
			
			pa._ += pa.v
			
			// force into min max bounds
			pa._ = Math.max(gMin[attr], pa._)
			pa._ = Math.min(gMax[attr], pa._)
			
			if (log.contains(attr, "_")) pa.log._.push(pa._)
			if (log.contains(attr, "v")) pa.log.v.push(pa.v)
			if (log.contains(attr, "acc")) pa.log.acc.push(pa.acc)
		}
	}
	
	log.contains = function(prop, attr) {
		for (var i=0; i<log.items.length; i++) {
			if (log.items[i][0] === prop && log.items[i][1] === attr)
				return true
		}
		return false
	}
	
	log.init = function() {
		for (var i=0; i<log.items.length; i++) {
			var e = log.items[i]
			var en = e[0]+"_"+e[1]+"_"+e[2]
			log[en] = []
			
			var orientation = undefined
			if (e[1] === "_")
				orientation = e[2] === "mean" ? gMean[e[0]] : gVar[e[0]]
			
			log["chart_"+en] = createChart(en, orientation)
		}
	}
	
	log.updateLog = function() {
		for (var i=0; i<log.items.length; i++) {
			var e = log.items[i]
			var en = e[0]+"_"+e[1]+"_"+e[2]
			var l = log[en]
			l.push(e[2] === "mean"
				? mean(plsList(e[0], e[1]))
				: variance(plsList(e[0], e[1])))
			var chart = log["chart_"+en]
			chart.updateChart(l)
			for (var k=0; k<pls.length; k++) {
				chart.addToChart(pls[k][e[0]].log[e[1]])
			}
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
		.attr("transform", "translate("+x+", "+y+")") //  scale("+1+")
		.style({
			"fill": d3.hsl(h/255*360, s/255, l/255),
			"fill-opacity": a,
			"filter": "url(#"+filterName+")"
		})
	c.feGaussianBlur = feGaussianBlur
	return c
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
	
	var yDomainMin = Number.POSITIVE_INFINITY
	var yDomainMax = Number.NEGATIVE_INFINITY
	
	function updateAxis(data) {
		x.domain([0, data.length-1])
		var extent = d3.extent(data)
		yDomainMin = Math.min(yDomainMin, extent[0])
		yDomainMax = Math.max(yDomainMax, extent[1])
		
		y.domain([yDomainMin, yDomainMax])
		xg.call(xAxis)
		yg.call(yAxis)
	}
	
	self.updateChart = function(data) {
		updateAxis(data)
		
		pathG.remove()
		pathG = svgPlot.append("g")
		pathG.append("path")
			.datum(data)
			.attr("class", "line")
			.attr("d", line)
			
		x.domain([0, 1])
		
		if (orientationBaseline !== undefined) {
			pathOrientationHorizontal.remove()
			pathOrientationHorizontal = svgPlot.append("path")
				.datum([orientationBaseline, orientationBaseline])
				.attr("class", "orientationBaseline")
				.attr("d", line)
		}
	}
	
	self.addToChart = function(data) {
		updateAxis(data)
		pathG.append("path")
			.datum(data)
			.attr("class", "particle")
			.attr("d", line)
	}
		
	return self
}

function setUpKShortcuts() {
	function openSVG() {
		window.open("data:image/svg+xml," + encodeURIComponent(
			document.getElementById("svgWrapper").innerHTML
		))
	}

	document.addEventListener("keydown", function (evt) {
		switch(evt.keyCode) {
			case 83: openSVG(); break // s
			case 69: // e
				pauseStepping = !pauseStepping
				if (!pauseStepping) psys.start()
				break
		}
	}, false)
}

return bokeh
}()
