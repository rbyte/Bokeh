
bokeh = function() { // spans everything - not indented
var bokeh = {}

var svgWidth = 400
var svgHeight = 300
var SVGsizeInWindow = 0.2 // percent
var codeMirror = {inUse: false}

var properties = ["x","y","r","h","s","l","a","g"]
var propFullName = {x: "Horizonal Position", y: "Vertical Position", r: "Radius",
	h: "Hue", s: "Saturation", l: "Lightness", a: "Alpha", g: /*Gauss Smoothing*/ "Blur"}

var gMean=	{h: 140,	s: 180,	l: 180,	a: .20,	g: svgWidth*.04,	x: svgWidth*.5,		y: svgHeight*.5,	r: svgWidth*.15}
var gVar=	{h: 7,		s: 10,	l: 40,	a: .10,	g: svgWidth*.025,	x: svgWidth*.22,	y: svgHeight*.22,	r: svgWidth*.07}
var gMin=	{h: 0,		s: 0,	l: 0,	a: 0,	g: svgWidth*.002,	x: svgWidth*-.20,	y: svgHeight*-.20,	r: svgWidth*0}
var gMax=	{h: 255,	s: 255,	l: 255,	a: .8,	g: svgWidth*.1,		x: svgWidth*1.20,	y: svgHeight*1.20,	r: svgWidth*1}
var actF=	{h: 1,		s: 1,	l: 1,	a: 1,	g: 1, x: 1, y: 1, r: 0.5}
var bgColor= {h: 151,	s: 77,	l: 111,	a: 0} // TODO
var distributionSliders = {}

// stddeviation/g=0 is not supported in inkscape (circles will not show)
if (/*disableBlur = */ false) {
	gMax.g = gMin.g = 0
}

var log = {}
//log.items = [["h", "_", "mean"]]
//log.items = [["g", "_", "mean"], ["r", "_", "mean"],["a", "_", "mean"], ["x", "_", "mean"], ["y", "_", "mean"]]
log.items = []

var pls = [] // particle list
var numberOfParticles = 20
var kissenSize = 0.02 // [0, 0.5]
var activityFactor = 1/2000
var activityRoundsMax = 150
var accDeltaAbsMax = 0.02
var triggerActivityPropability = 0.05 // influenced by number of particles
var predDampen = 20
var transition = false
var transitionDuration = 100
var pauseStepping = false

var lastStep
var timeDeltaBetweenSteps = []
var lastFPSupdate

bokeh.run = function () {
	setUpSVG()
	codeMirror.init()
	
	log.init()
	setUpDistributionSlider("h")
	setUpDistributionSlider("s")
	setUpDistributionSlider("a")
	setUpDistributionSlider("g")
	setUpDistributionSlider("r")
	
	var shapeScaleSlider = d3.slider()
		.min(1)
		.max(100)
		.step(1)
		.value(numberOfParticles)
		.on("slide", function(evt, value) {
//			console.log("baal: "+value)
			if (!isNaN(value))
				numberOfParticles = value
		})
	d3.select("#particleSlider").call(shapeScaleSlider)	
	
	setUpKShortcuts()
	progressParticleSystem()
}

codeMirror.init = function() {
	if (this.inUse) {
		codeMirror._ = CodeMirror(document.body, {
			value: "",
			mode: "javascript",
			indentWithTabs: true,
			lineNumbers: true
			/*matchBrackets: true*/
		})
		codeMirror._.on("change", function() {})
	}
}

function setUpDistributionSlider(p) {
//	var svg = d3.select("#distSliderSVG")
	// outer rectangle, that contains everything
	distributionSliders[p] = {}
	
	var svg = distributionSliders[p].svg = d3.select("#dsvg")
		.append("svg")
		.attr("id", "distSliderSVG_"+p)
		.attr("xmlns", "http://www.w3.org/2000/svg")
		// TODO gives namespace error, but does not seem to matter
//		.attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
//		.attr("width", 200)
//		.attr("height", 400)
		.attr("viewBox", "0 0 "+200+" "+400)
		.attr("class", "hidden")
		.attr("isToggledOn", "false") // custom; via click
	
	var defs = svg.append("defs")
	// every distributionSlider has defs for all types
	// if one svg is display: hidden, its def ids cannot be referenced anymore
	// therefore, the ids have to be specific to each svg
	var allHues = defs.append("linearGradient").attr("id", "lgrad_h_"+p)
	allHues.append("stop").style({"stop-color": "#ff0000"}).attr("offset", 0)
	allHues.append("stop").style({"stop-color": "#ffff00"}).attr("offset", 0.18512578)
	allHues.append("stop").style({"stop-color": "#00ff00"}).attr("offset", 0.34256288)
	allHues.append("stop").style({"stop-color": "#00ffff"}).attr("offset", 0.5)
	allHues.append("stop").style({"stop-color": "#0000ff"}).attr("offset", 0.65429997)
	allHues.append("stop").style({"stop-color": "#ff00ff"}).attr("offset", 0.8119877)
	allHues.append("stop").style({"stop-color": "#ff0000"}).attr("offset", 1)
	
	var saturation = defs.append("linearGradient").attr("id", "lgrad_s_"+p)
	saturation.append("stop").style({"stop-color": "#888"}).attr("offset", 0)
	saturation.append("stop").style({"stop-color": "#f00"}).attr("offset", 1).attr("class", "lgrad_hueDependentColour")
	
	var alpha = defs.append("linearGradient").attr("id", "lgrad_a_"+p)
	alpha.append("stop").style({"stop-color": "#888", "stop-opacity": "0"}).attr("offset", 0).attr("class", "lgrad_hueDependentColour")
	alpha.append("stop").style({"stop-color": "#f00"}).attr("offset", 1).attr("class", "lgrad_hueDependentColour")
	
	var gamma = defs.append("linearGradient").attr("id", "lgrad_g_"+p)
	gamma.append("stop").style({"stop-color": "#000"}).attr("offset", 0)
	gamma.append("stop").style({"stop-color": "#fff"}).attr("offset", 1)
	
	var radius = defs.append("linearGradient").attr("id", "lgrad_r_"+p)
	radius.append("stop").style({"stop-color": d3.hsl(147/255*360, 194/255, 138/255)}).attr("offset", 0)
	radius.append("stop").style({"stop-color": "#fff"}).attr("offset", 1)
	
	defs.append("linearGradient")
		.attr("id", "lgradVert_"+p)
		.attr("xlink:href", "#lgrad_"+p+"_"+p)
		.attr("gradientTransform", "rotate(90)")
	
	var whiteShade = defs.append("linearGradient").attr("id", "whiteShade")
	whiteShade.append("stop").style({"stop-color": "#fff", "stop-opacity": "0"}).attr("offset", 0)
	whiteShade.append("stop").style({"stop-color": "#fff", "stop-opacity": ".4"}).attr("offset", 1)
	
	const opx = 0, opy = 0, ow = 200, oh = 400,
	// percent of width the scale takes
	perc = .10,
	// the drag area rectangle (a portion of outer)
	px = opx+ow*perc, py = opy, w = ow*(1-perc), h = oh,
	left = .15, right = .05, top = .01, bottom = .01,
	topSpan = .3, baseSpan = .8, varianceSpan = .2
	
	function getPath(x, y) {
		x += 3 // so that the cursor is always inside the curve area -> crosshair
		function bound(l, x, h) { return Math.max(Math.min(x, h), l) }
		// mouse position x & y, relative to box and forced into margin
		var rX = bound(left, (x-px)/w, 1-right)
		var rY = bound(top, (y-py)/h, 1-bottom)
		
		// half y span of ground
		var vrc = (1-rX)*.5
		var pre = gMean[p]
		gMean[p] = (gMax[p] - gMin[p]) * rY
		console.log(pre+" -> "+gMean[p])
		pre = gVar[p]
		// 0.3 is a "looks good" approximation
		gVar[p] = (gMax[p] - gMin[p]) * vrc * 0.3
		console.log(pre+" -> "+gVar[p])
		
		// the upper and lower extreme cannot go beyond the border,
		// because it distorts the background pattern & such a distribution
		// is not logical
		var vrcUp = vrc
		var vrcDown = vrc
		if (rY-vrc < 0)
			vrcUp = rY
		if (rY+vrc > 1)
			vrcDown -= rY+vrc-1
		
		// do not overshoot
//		vrc = Math.min(vrc, (.5 - Math.abs(rY - .5)))
//		rX = bound(1-vrc*2, rX, 1)
		
		// http://www.w3.org/TR/SVG/paths.html#PathData
		// the start and end point are only needed for the fill (hueScale)
		// to be aligned correctly
		// see DistributionSliderPathIllustration.svg
		return ("M"+px+","+py
			// upper base point
			+" L"+px+","+(py+(rY - vrcUp)*h)
			// base control point
			+" c0,"+vrcUp*baseSpan*h+" "
			// peak control point
			+rX*w+","+(vrcUp*h-Math.min(vrcUp,vrcDown)*h*topSpan)+" "
			// peak point
			+rX*w+","+vrcUp*h
			// base control point
			+" s-"+rX*w+","+vrcDown*(1-baseSpan)*h
			// lower base point
			+" -"+rX*w+","+vrcDown*h
			+" L"+px+","+(py+h)
			+"Z")
	}
	
	distributionSliders[p].updateParticles = function() {
		if (distributionSliders[p].dssvgg !== undefined)
			distributionSliders[p].dssvgg.remove()
		distributionSliders[p].dssvgg = svg
			.append("g").attr("id", "distSliderSVGcircles")
		
		if (p === "h")
			d3.selectAll(".lgrad_hueDependentColour").style({"stop-color":
				d3.hsl(gMean.h/255*360, 255/255, 125/255)})
		
		for (var i=0; i<pls.length; i++) {
			var yy =  (pls[i][p]._ - gMin[p]) / (gMax[p]-gMin[p]) * h
			
			distributionSliders[p].dssvgg.append("path")
				.attr("d", "M0,"+yy+" L"+ow*perc+","+yy)
				.style({
					"stroke": "#fff", // d3.hsl(0/255*360, 0/255, 255/255)
					"stroke-opacity": .5,
					"stroke-width": 4,
					"stroke-linecap": "butt"
				})
		}
	}
	
	var drag = d3.behavior.drag()
		.on("drag", dragmove)
	
	function dragmove(d) {
		distributionCurve.attr("d", getPath(d3.event.x, d3.event.y))
	}
	
	svg.append("rect")
		.attr("class", "dragArea")
		.attr("x", px)
		.attr("y", py)
		.attr("width", w)
		.attr("height", h)
		// fill "none" will disable drag
		.style({"fill": "none", "stroke": "#ccc", "stroke-width": 1})
		.call(drag)
	
	var distributionCurve = svg.append("path")
		.attr("class", "distributionCurve")
		.attr("d", getPath( // 6.7 is an approximation
			px+w*(1 - gVar[p] / (gMax[p]-gMin[p]) * 6.7),
			py+h*(gMean[p] - gMin[p]) / (gMax[p]-gMin[p])))
		.style({'fill': "url(#lgradVert_"+p+")"})
		.call(drag)
	
	// produces the opacity background pattern
	if (p === "a") {
		var side = ow*perc/4
		for (var i=0; i<4; i++)
			for (var k=0; k<oh/side; k++)
				svg.append("rect")
					.attr("width", side)
					.attr("height", side)
					.attr("x", opx+i*side)
					.attr("y", opy+k*side)
					.style({"fill": (i+k) % 2 ? "#ddd" : "#999"})
	}
	
	svg.append("rect")
		.attr("class", "scale")
		.attr("width", ow*perc)
		.attr("height", oh)
		.attr("x", opx)
		.attr("y", opy)
		.style({'fill': "url(#lgradVert_"+p+")"})
	
	if (p === "g") {
		svg.append("path").style({'fill': "#ddd"})
			.attr("d", "M"+opx+","+opy+" L"+opx+","+opy+h+" L"+opx+ow*perc*.5+","+opy)
		svg.append("path").style({'fill': "#ddd"})
			.attr("d", "M"+opx+ow*perc+","+opy+" L"+opx+ow*perc+","+opy+h+" L"+opx+ow*perc*.5+","+opy)
	}

	svg.append("rect")
		.attr("class", "whiteOverlay")
		.attr("width", ow*perc*0.5)
		.attr("height", oh)
		.attr("x", opx+ow*perc*0.5)
		.attr("y", opy)
		.style({'fill': 'url(#whiteShade)'})
	
	svg.append("text")
		.attr("x", opx+ow*(perc+.03))
		.attr("y", opy+oh*.05)
		.text(propFullName[p])
	
}

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

	p.obj = createSVGcircle(p.x._, p.y._, p.r._, p.h._, p.s._, p.l._, p.a._, p.g._)
	return p
}

function progressParticleSystem() {
	if (pauseStepping)
		return

	updateFpsCounter()
	
	if (codeMirror.inUse) {
		try {
			eval(codeMirror._.getValue())
		} catch(e) {
//			if (e instanceof SyntaxError) {
			console.log(e)
		}
	}

	for (var i=1; pls.length - numberOfParticles !== 0; i++) {
		if (pls.length > numberOfParticles) {
			pls.shift().obj.remove()
		} else {
			var p = new Particle(numberOfParticles+i)
			pls.push(p)
			// particles in front are brighter
			var lvar = gVar.l/255
			p.l._ *= ((1-lvar)+i/numberOfParticles*(lvar*2))
		}
	}

	for (var i=0; i<properties.length; i++)
		// lightness is bound to z-index
		if (properties[i] !== "l")
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
	for(var prop in distributionSliders)
		distributionSliders[prop].updateParticles()
	
	for (var i=0; i<pls.length; i++) {
		var p = pls[i]

		function applyTransition(obj) {
			if (transition) {
				obj = obj.transition()
					.duration(transitionDuration)
					.ease(d3.ease("linear"))
			}
			return obj
		}

		applyTransition(p.obj.feGaussianBlur)
			.attr("stdDeviation", p.g._)

		applyTransition(d3.select("#backgroundRect"))
			.style("fill", d3.hsl(bgColor.h/255*360, bgColor.s/255, bgColor.l/255) )
			.style("fill-opacity", bgColor.a)

		var t = applyTransition(p.obj)
			.style("fill", d3.hsl(p.h._/255*360, p.s._/255, p.l._/255) )
			.style("fill-opacity", p.a._)
			.attr("r", p.r._)
			.attr("transform", "translate("+p.x._+", "+p.y._+")")

		if (transition && i === pls.length-1)
			t.each("end", progressParticleSystem)
	}
	// lets the browser render, then restarts
	if (!transition)
		setTimeout(progressParticleSystem, 50)
}

function step(attr) {
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
		if (kissen > 0) {
			var intoMinKissen = (pa._ - gMin[attr]) / kissen
			if (intoMinKissen < 1 && pa.v < 0)
				pa.v *= intoMinKissen
			var intoMaxKissen = (gMax[attr] - pa._) / kissen
			if (intoMaxKissen < 1 && pa.v > 0)
				pa.v *= intoMaxKissen
		}

		pa._ += pa.v

		// force into min max bounds
		pa._ = Math.max(gMin[attr], pa._)
		pa._ = Math.min(gMax[attr], pa._)

		if (log.contains(attr, "_")) pa.log._.push(pa._)
		if (log.contains(attr, "v")) pa.log.v.push(pa.v)
		if (log.contains(attr, "acc")) pa.log.acc.push(pa.acc)
	}
}

// this is actually a steps per second function.
// if transitions are enabled, multiple frames may be drawn between steps
function updateFpsCounter() {
	var curTime = new Date().getTime()
	if (lastStep !== undefined) {
		var tDeltaMS = curTime - lastStep
		timeDeltaBetweenSteps.push(tDeltaMS)
		if (timeDeltaBetweenSteps.length > 10) {
			if (lastFPSupdate === undefined || curTime-lastFPSupdate > 1000) {
				lastFPSupdate = curTime
				d3.select("#fps").text(Math.round(1000/mean(timeDeltaBetweenSteps))+" fps")
			}
			// remove oldest
			timeDeltaBetweenSteps.shift()
		}
	}
	lastStep = curTime
}

function setUpSVG() {
	var svg = d3.select("#svg")
//	svg.attr("width", svgWidth)
//	svg.attr("height", svgHeight)
	svg.attr("viewBox", "0 0 "+svgWidth+" "+svgHeight)
	setSVGSizeInWindow()

	svg.append("rect")
		.attr("id", "backgroundRect")
		.attr("x", 0)
		.attr("y", 0)
		.attr("width", "100%")
		.attr("height", "100%")
		.style("fill", d3.hsl(bgColor.h/255*360, bgColor.s/255, bgColor.l/255) )
		.style("fill-opacity", bgColor.a)

	// in chrome, the svg viewbox aspect is not honored. the svg is stretched to
	// width and height 100% of the parent and "overflow" (objects outside of the viewbox)
	// are visible
	// surround viewbox with white rectangles
	svg.append("rect").attr("x", "100%").attr("y", "-100%").attr("width", "100%").attr("height", "300%").style("fill", "#fff" )
	svg.append("rect").attr("x", "-100%").attr("y", "-100%").attr("width", "100%").attr("height", "300%").style("fill", "#fff" )
	svg.append("rect").attr("x", "0%").attr("y", "-100%").attr("width", "100%").attr("height", "100%").style("fill", "#fff" )
	svg.append("rect").attr("x", "0%").attr("y", "100%").attr("width", "100%").attr("height", "100%").style("fill", "#fff" )

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
		log["chart_"+en] = createChart(en)
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
		chart.updateChart(l, gMin[e[0]], gMax[e[0]])
		for (var k=0; k<pls.length; k++) {
			chart.addParticlesToChart(pls[k][e[0]].log[e[1]])
		}
	}
}

function createChart(name) {
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
	
	self.updateChart = function(data, min, max) {
		x.domain([0, data.length-1])
		y.domain([min, max])
		xg.call(xAxis)
		yg.call(yAxis)
		
		pathG.remove()
		pathG = svgPlot.append("g")
		pathG.append("path")
			.datum(data)
			.attr("class", "line")
			.attr("d", line)
			
		x.domain([0, 1])
	}
	
	self.addParticlesToChart = function(data) {
		x.domain([0, data.length-1])
		xg.call(xAxis)
		
		pathG.append("path")
			.datum(data)
			.attr("class", "particle")
			.attr("d", line)
	}
		
	return self
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

function createSVGcircle(x, y, r, h, s, l, a, g) {
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

function round(number) {
	return Number(number.toFixed(1))
}

function openSVG() {
	var svg = document.getElementById("svg")
	window.open("data:image/svg+xml," + encodeURIComponent(
	// http://stackoverflow.com/questions/1700870/how-do-i-do-outerhtml-in-firefox
		svg.outerHTML || new XMLSerializer().serializeToString(svg)
	))
}

function pause() {
	pauseStepping = !pauseStepping
	if (!pauseStepping)
		progressParticleSystem()
}

function setSVGSizeInWindow(percent) {
	if (percent !== undefined)
		SVGsizeInWindow = Math.max(percent, 0.05)
	// 1/3* because the wrappers size is 300%
	// this allows the zooming of the svg beyond the page borders
	d3.select("#svg")
		.style("max-height", 1/3*100*SVGsizeInWindow+"%")
		.style("max-width", 1/3*100*SVGsizeInWindow+"%")
}

function setUpKShortcuts() {
	document.addEventListener("keydown", function (evt) {
		switch(evt.keyCode) {
			case 83: /*s*/ openSVG(); break
			case 69: /*e*/ pause(); break
			case 107:/*+*/ setSVGSizeInWindow(SVGsizeInWindow*1.1); break
			case 109:/*-*/ setSVGSizeInWindow(SVGsizeInWindow*0.9); break
		}
	}, false)
}

function distributionSliderHide(p, hide) {
	var ds = d3.select("#distSliderSVG_"+p)
	if (ds.attr("isToggledOn") === "false")
		ds.classed("hidden", hide)
}

function distributionSliderToggle(p) {
	// if toogled, it is visible, because the mouse has to be on the symbol
	var ds = d3.select("#distSliderSVG_"+p)
	var toggledOn = ds.attr("isToggledOn") === "false"
	ds.attr("isToggledOn", toggledOn ? "true" : "false")
	d3.select("#li_"+p).classed("toggledOn", toggledOn)
}



bokeh.mouseoverHue = function() { distributionSliderHide("h", false) }
bokeh.mouseoutHue = function() { distributionSliderHide("h", true) }
bokeh.clickHue = function() { distributionSliderToggle("h") }

bokeh.mouseoverSaturation = function() { distributionSliderHide("s", false) }
bokeh.mouseoutSaturation = function() { distributionSliderHide("s", true) }
bokeh.clickSaturation = function() { distributionSliderToggle("s") }

bokeh.mouseoverGamma = function() { distributionSliderHide("g", false) }
bokeh.mouseoutGamma = function() { distributionSliderHide("g", true) }
bokeh.clickGamma = function() { distributionSliderToggle("g") }

bokeh.mouseoverAlpha = function() { distributionSliderHide("a", false) }
bokeh.mouseoutAlpha = function() { distributionSliderHide("a", true) }
bokeh.clickAlpha = function() { distributionSliderToggle("a") }

bokeh.mouseoverRadius = function() { distributionSliderHide("r", false) }
bokeh.mouseoutRadius = function() { distributionSliderHide("r", true) }
bokeh.clickRadius = function() { distributionSliderToggle("r") }

bokeh.mouseoverParticle = function() {}
bokeh.mouseoutParticle = function() {}
bokeh.clickParticle = function() {}

bokeh.mouseoverBackground = function() {}
bokeh.mouseoutBackground = function() {}
bokeh.clickBackground = function() {}

// right
bokeh.mouseoverSize = function() {}
bokeh.mouseoutSize = function() {}
bokeh.clickSize = function() {}

bokeh.mouseoverTransition = function() {}
bokeh.mouseoutTransition = function() {}
bokeh.clickTransition = function() {}

bokeh.mouseoverDownload = function() {}
bokeh.mouseoutDownload = function() {}
bokeh.clickDownload = function() {}

bokeh.mouseoverSource = function() {}
bokeh.mouseoutSource = function() {}
bokeh.clickSource = function() {}



return bokeh
}()
