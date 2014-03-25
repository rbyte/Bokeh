
bokeh = function() { // spans everything - not indented
var bokeh = {}

var svgViewboxWidth = 400
var svgViewboxHeight = 300
var codeMirror = {inUse: false}

var pProperties = ["h","s","l","a","g","x","y","r"]
var pPropertiesName = {
	h: "Hue", s: "Saturation", l: "Lightness", a: "Opacity",
	g: /*Gauss Smoothing*/ "Blur", x: "Horizonal Position",
	y: "Vertical Position", r: "Radius"}

var gMean=	{h: 140,s: 180,	l: 180,	a: .20,	g: .04,	x: .5,	y: .5,	r: .15}
var gVar=	{h: 7,	s: 10,	l: 40,	a: .10,	g: .025,x: .22,	y: .22,	r: .07}
var gMin=	{h: 0,	s: 0,	l: 0,	a: 0,	g: .001,x: -.2,	y: -.2,	r: 0, transitionDuration: 0, numberOfParticles: 1, SVGsizeInWindow: 0.01}
var gMax=	{h: 255,s: 255,	l: 255,	a: .8,	g: .1,	x: 1.2,	y: 1.2,	r: .4, transitionDuration: 1000, numberOfParticles: 100, SVGsizeInWindow: 2}

var arr = [gMean, gVar, gMin, gMax]
arr.forEach(function(e) {
    e.g *= svgViewboxWidth
	e.x *= svgViewboxWidth
	e.y *= svgViewboxHeight
	e.r *= svgViewboxWidth
})

// stddeviation/g=0 is not supported in inkscape (circles will not show)
if (/*disableBlur = */ false) {
	gMax.g = gMin.g = 0
}

var bgColor={h: 151,s: 77,	l: 111,	a: 1} // TODO
var bgColorMax={h: 255,s: 255,	l: 255,	a: 1}
var distributionSliders = {}
var log = {}
//log.items = [["h", "_", "mean"], ["h", "_", "var"]]
//log.items = [["g", "_", "mean"], ["r", "_", "mean"],["a", "_", "mean"], ["x", "_", "mean"], ["y", "_", "mean"]]
log.items = []

var pls = [] // particle list
var SVGsizeInWindow = 0.2 // percent
var numberOfParticles = 20
// if 0, no transition is triggered (just steps)
var transitionDuration = 0
const kissenSize = 0.02 // [0, 0.5]
const globalActivityFactor = 1
const activityRoundsMax = 150
const accDeltaAbsMax = 0.25
const triggerActivityPropability = 0.1 // TODO influenced by number of particles
const predDampen = 9
var pauseStepping = false

var lastStep
var timeDeltaBetweenSteps = []
var lastFPSupdate

bokeh.run = function () {
	setUpSVG()
	codeMirror.init()
	log.init()
	setUpSliders()
	setUpKShortcuts()
	progressParticleSystem()
}

function setUpSliders() {
	setUpDistributionSlider("h")
	setUpDistributionSlider("s")
	setUpDistributionSlider("a")
	setUpDistributionSlider("g")
	setUpDistributionSlider("r")
	
	var bgSliderProps = ["h", "s", "l", "a"]
	var lightnessStop = d3.selectAll("#lightnessStop")
	var saturationStop = d3.selectAll("#saturationStop")
	var bgResultColourDep = d3.selectAll(".bgResultColourDep")
	var bgSymbolPath = d3.selectAll("#bgSymbolPath")
	var bgSymbolPathForAlpha = d3.selectAll("#bgSymbolPathForAlpha")
	
	bgSliderProps.forEach(function(e) {
		var barW = 300-3 // -3 for slider width
		var pName = pPropertiesName[e]
		var slider = d3.select("#bg"+pName+"Slider")
		var rX = bgColor[e] / bgColorMax[e] // in [0,1]
		function set(rX) {
			slider.attr("x", rX * barW)
			saturationStop.style({"stop-color": d3.hsl(bgColor.h/255*360, 1, .5)})
			lightnessStop.style({"stop-color": d3.hsl(bgColor.h/255*360, bgColor.s/255, .5)})
			var color = d3.hsl(bgColor.h/255*360, bgColor.s/255, bgColor.l/255)
			bgResultColourDep.style({"stop-color": color})
			bgSymbolPath.style({"fill": color})
			bgSymbolPathForAlpha.style({"fill-opacity": 1-bgColor.a})
		}
		set(rX)
		d3.select("#bg"+pName).call(d3.behavior.drag().on("drag", function (d) {
			console.log(d3.event.x)
			var rX = bound(0, d3.event.x, barW) / barW
			bgColor[e] = rX * bgColorMax[e]
			set(rX)
		}))
	})
	
	var sliders = ["numberOfParticles", "transitionDuration", "SVGsizeInWindow"]
	updateParticleSymbolSVG()
	
	sliders.forEach(function(e) {
		var barW = 100
		var knob = d3.select("#"+e+"_myFader .faderKnob")
		var faderForeground = d3.select("#"+e+"_myFader .faderForeground")
		var rX = eval(e) / gMax[e]
//		if (e === "numberOfParticles") val = numberOfParticles
		if (e === "transitionDuration") {
			rX = 1 - rX
			d3.selectAll(".sizeSVGspeedIndicator").style({"stroke-opacity": rX})
		}
//		if (e === "SVGsizeInWindow") val = SVGsizeInWindow
		
		knob.attr("cx", rX*barW)
		faderForeground.attr("width", rX*barW)
		
		knob.call(d3.behavior.drag().on("drag", function (d) {
			var rX = bound(0, d3.event.x, barW) / barW
			
			if (e === "numberOfParticles") {
				numberOfParticles = Math.max(gMin[e], Math.round(rX*gMax[e]))
				updateParticleSymbolSVG()
			}
			if (e === "transitionDuration") {
				transitionDuration = Math.max(gMin[e], (1-rX)*gMax[e])
				d3.selectAll(".sizeSVGspeedIndicator").style({"stroke-opacity": rX})
			}
			if (e === "SVGsizeInWindow") {
				SVGsizeInWindow = Math.max(gMin[e], rX*gMax[e])
				setSVGSizeInWindow(SVGsizeInWindow)
			}
			knob.attr("cx", rX*barW)
			faderForeground.attr("width", rX*barW)
		}))
	})
}

codeMirror.init = function() {
	if (codeMirror.inUse) {
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

function bound(l, x, h) { return Math.max(Math.min(x, h), l) }

function setUpDistributionSlider(p) {
//	var svg = d3.select("#distSliderSVG")
	// outer rectangle, that contains everything
	distributionSliders[p] = {}
	
	const opx = 0, opy = 0, ow = 300, oh = 100,
	// percent of width the scale takes
	perc = .10,
	horizontal = true,
	// the drag area rectangle (a portion of outer)
	px = opx+(horizontal ? 0 : ow*perc),
	py = opy,
	w = ow*(horizontal ? 1 : 1-perc),
	h = oh*(horizontal ? 1-perc : 1),
	varianceOfVrc = .375,
	toGroundCutoff = .2,
	varFactorIntoPath = 5,
	stdMargin = .03,
	left = horizontal ? stdMargin : toGroundCutoff,
	right = stdMargin,
	top = stdMargin,
	bottom = horizontal ? toGroundCutoff :stdMargin,
	topSpan = .3, baseSpan = .8, varianceSpan = .2
	
	var svg = distributionSliders[p].svg = d3.select("#li_"+p+"_dsvg")
		.append("svg")
		.attr("id", "distSliderSVG_"+p)
		.attr("xmlns", "http://www.w3.org/2000/svg")
		.attr("viewBox", "0 0 "+ow+" "+oh)
		.attr("preserveAspectRatio", "xMinYMid meet")
	
//	d3.selectAll("menu li").attr("isToggledOn", "false")
	
	function getPath(x, y) {
		// so that the cursor is always inside the curve area -> crosshair
		if (horizontal) y -= 3
		else x += 3
		// mouse position x & y, relative to box and forced into margin
		var rX = (x-px)/w
		var rY = (y-py)/h
		
		rX = bound(left, rX, 1-right)
		rY = bound(top, rY, 1-bottom)
		
		// half span of ground
		var vrc = (horizontal ? rY : 1-rX)*(.5+toGroundCutoff)
		var preMean = gMean[p]
		gMean[p] = gMin[p] + (gMax[p] - gMin[p]) * (horizontal ? rX : rY)
		var preVar = gVar[p]
		// a "looks good" approximation
		gVar[p] = (gMax[p] - gMin[p]) * vrc * varianceOfVrc
		if (false) {
			console.log(p+" mean: "+preMean+" -> "+gMean[p])
			console.log(p+" var: "+preVar+" -> "+gVar[p])
		}
		
		// the upper and lower extreme cannot go beyond the border,
		// because it distorts the background pattern & such a distribution
		// is not logical
		var vrcUp = vrc
		var vrcDown = vrc
		if (rX-vrc < 0)
			vrcUp = rX
		if (rX+vrc > 1)
			vrcDown -= rX+vrc-1
		
		// do not overshoot
//		vrc = Math.min(vrc, (.5 - Math.abs(rY - .5)))
//		rX = bound(1-vrc*2, rX, 1)
		
		// http://www.w3.org/TR/SVG/paths.html#PathData
		// the start and end point are only needed for the fill (hueScale)
		// to be aligned correctly
		// see DistributionSliderPathIllustration.svg
		return (!horizontal ?
		("M"+px+","+py
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
		: ("M"+px+","+py+h
			// upper base point
			+" L"+(px+(rX - vrcUp)*w)+","+(py+h)
			// base control point
			+" c"+vrcUp*baseSpan*w+",0 "
			// peak control point
			+(vrcUp*w-Math.min(vrcUp,vrcDown)*w*topSpan)+",-"+(1-rY)*h+" "
			// peak point
			+vrcUp*w+",-"+(1-rY)*h
			// base control point
			+" s"+vrcDown*(1-baseSpan)*w+","+(1-rY)*h
			// lower base point
			+" "+vrcDown*w+","+(1-rY)*h
			+" L"+(px+w)+","+(py+h)
			+"Z")
		)
	}
	
	distributionSliders[p].updateParticles = function() {
		if (distributionSliders[p].dssvgg !== undefined)
			distributionSliders[p].dssvgg.remove()
		distributionSliders[p].dssvgg = svg
			.append("g").attr("id", "distSliderSVGcircles")
		
		if (p === "h")
			d3.selectAll(".lgrad_hueDependentColour").style({"stop-color":
				d3.hsl(gMean.h/255*360, 255/255, 127/255)})
		if (p === "g")
			d3.select("#li_g_svg_feGaussianBlur")
				.attr("stdDeviation", Math.sqrt((gMean.g-gMin.g) / (gMax.g-gMin.g))*50)
		if (p === "a") {
			var val = 0.25 + (gMean.a-gMin.a) / (gMax.a*2-gMin.a)
			d3.select("#li_a_svg_stopFadeMiddle")
				.style("stop-opacity", val).attr("offset", val)
		}
		
		for (var i=0; i<pls.length; i++) {
			var z =  (pls[i][p]._ - gMin[p]) / (gMax[p]-gMin[p])
			
			distributionSliders[p].dssvgg.append("path")
				.attr("d", horizontal
					? "M"+z*w+","+py+h+" l0,"+(perc*oh)
					: "M0,"+z*h+" l"+ow*perc+",0")
				.style({
					"stroke": "#fff", // d3.hsl(0/255*360, 0/255, 255/255)
					"stroke-opacity": .5,
					"stroke-width": 2,
					"stroke-linecap": "butt"
				})
		}
	}
	
	var defs = svg.append("defs")
	if (p == "h") {
		var allHues = defs.append("linearGradient").attr("id", "lgrad_h_"+p)
		allHues.append("stop").style({"stop-color": "#ff0000"}).attr("offset", 0)
		allHues.append("stop").style({"stop-color": "#ffff00"}).attr("offset", 0.18512578)
		allHues.append("stop").style({"stop-color": "#00ff00"}).attr("offset", 0.34256288)
		allHues.append("stop").style({"stop-color": "#00ffff"}).attr("offset", 0.5)
		allHues.append("stop").style({"stop-color": "#0000ff"}).attr("offset", 0.65429997)
		allHues.append("stop").style({"stop-color": "#ff00ff"}).attr("offset", 0.8119877)
		allHues.append("stop").style({"stop-color": "#ff0000"}).attr("offset", 1)
	}
	if (p == "s") {
		var saturation = defs.append("linearGradient").attr("id", "lgrad_s_"+p)
		saturation.append("stop").style({"stop-color": "#888"}).attr("offset", 0)
		saturation.append("stop").style({"stop-color": "#f00"}).attr("offset", 1).attr("class", "lgrad_hueDependentColour")
	}
	if (p == "a") {
		var alpha = defs.append("linearGradient").attr("id", "lgrad_a_"+p)
		alpha.append("stop").style({"stop-color": "#888", "stop-opacity": "0"}).attr("offset", 0).attr("class", "lgrad_hueDependentColour")
		alpha.append("stop").style({"stop-color": "#f00"}).attr("offset", 1).attr("class", "lgrad_hueDependentColour")
	}
	if (p == "g") {
		var gamma = defs.append("linearGradient").attr("id", "lgrad_g_"+p)
		gamma.append("stop").style({"stop-color": "#000"}).attr("offset", 0)
		gamma.append("stop").style({"stop-color": "#ddd"}).attr("offset", 1)
	}
	if (p == "r") {
		var radius = defs.append("linearGradient").attr("id", "lgrad_r_"+p)
		radius.append("stop").style({"stop-color": d3.hsl(147/255*360, 194/255, 138/255)}).attr("offset", 0)
		radius.append("stop").style({"stop-color": "#fff"}).attr("offset", 1)
	}
	if (p == "a") {
		var alphaPattern = defs.append("pattern").attr("id", "alphaPattern_"+p)
			.attr("width", 5).attr("height", 5).attr("x", 0).attr("y", 0).attr("patternUnits", "userSpaceOnUse")
		alphaPattern.append("rect").style({"fill": "#fff"}).attr("x", 0).attr("y", 0).attr("width", 2.5).attr("height", 2.5)
		alphaPattern.append("rect").style({"fill": "#aaa"}).attr("x", 2.5).attr("y", 0).attr("width", 2.5).attr("height", 2.5)
		alphaPattern.append("rect").style({"fill": "#aaa"}).attr("x", 0).attr("y", 2.5).attr("width", 2.5).attr("height", 2.5)
		alphaPattern.append("rect").style({"fill": "#fff"}).attr("x", 2.5).attr("y", 2.5).attr("width", 2.5).attr("height", 2.5)
	}
	
	defs.append("linearGradient")
		.attr("id", "lgradVert_"+p)
		.attr("xlink:href", "#lgrad_"+p+"_"+p)
		.attr("gradientTransform", "rotate("+(horizontal ? 0 : 90)+")")
	
	var whiteShade = defs.append("linearGradient").attr("id", "whiteShade_"+p)
	whiteShade.append("stop").style({"stop-color": "#fff", "stop-opacity": (horizontal ? .4 : 0)}).attr("offset", 0)
	whiteShade.append("stop").style({"stop-color": "#fff", "stop-opacity": (horizontal ? 0 : .4)}).attr("offset", 1)
		
	defs.append("linearGradient")
		.attr("id", "whiteShadeVert_"+p)
		.attr("xlink:href", "#whiteShade_"+p)
		.attr("gradientTransform", "rotate("+(horizontal ? 90 : 0)+")")
	
	var drag = d3.behavior.drag()
		.on("drag", dragmove)
	
	function dragmove(d) {
		distributionCurve.attr("d", getPath(d3.event.x, d3.event.y))
	}
	
	var meanDim = (gMean[p] - gMin[p]) / (gMax[p]-gMin[p])
	var varDim = gVar[p] / (gMax[p]-gMin[p]) * varFactorIntoPath
	
	var distributionCurve = svg.append("path")
		.attr("class", "distributionCurve")
		.attr("d", getPath( 
			px+w*(horizontal ? meanDim : 1-varDim),
			py+h*(horizontal ? varDim : meanDim)))
		.style({'fill': "url(#lgradVert_"+p+")"})
		.call(drag)
	
	// produces the opacity background pattern
	if (p === "a") {
		
		svg.append("rect")
			.attr("width", ow)
			.attr("height", oh*perc)
			.attr("x", opx)
			.attr("y", opy+(1-perc)*oh)
			.style({'fill': "url(#alphaPattern_"+p+")"})
		
//		var side = (horizontal ? oh : ow)*perc/4
//		for (var i=0; i<4; i++)
//			for (var k=0; k<(horizontal ? ow : oh)/side; k++)
//				svg.append("rect")
//					.attr("width", side)
//					.attr("height", side)
//					.attr("x", opx+(horizontal ? k : i)*side)
//					.attr("y", py+(horizontal ? h : 0)+(horizontal ? i : k)*side)
//					.style({"fill": (i+k) % 2 ? "#ddd" : "#999"})
	}
	
	svg.append("rect")
		.attr("class", "scale")
		.attr("width", ow)
		.attr("height", oh*perc)
		.attr("x", opx)
		.attr("y", opy+(1-perc)*oh)
		.style({'fill': "url(#lgradVert_"+p+")"})
	
	if (p === "g") {
		if (horizontal) {
			svg.append("path").style({'fill': "#ddd"})
				.attr("d", "M0,"+(py+h)+" L"+(px+w)+","+(py+h)+" L0,"+(py+h+perc*.5*oh)+" Z")
			svg.append("path").style({'fill': "#ddd"})
				.attr("d", "M0,"+(py+oh)+" L"+(px+w)+","+(py+oh)+" L0,"+(py+h+perc*.5*oh)+" Z")
		} else {
			svg.append("path").style({'fill': "#ddd"})
				.attr("d", "M"+opx+","+opy+" L"+opx+","+opy+h+" L"+opx+ow*perc*.5+","+opy)
			svg.append("path").style({'fill': "#ddd"})
				.attr("d", "M"+opx+ow*perc+","+opy+" L"+opx+ow*perc+","+opy+h+" L"+opx+ow*perc*.5+","+opy)
		}
	}

	svg.append("rect")
		.attr("class", "whiteOverlay")
		.attr("width", horizontal ? ow : ow*perc*0.5)
		.attr("height", horizontal ? oh*perc*0.5 : oh)
		.attr("x", horizontal ? opx : opx+ow*perc*0.5)
		.attr("y", horizontal ? opy+oh*(1-perc) : opy)
		.style({'fill': "url(#whiteShadeVert_"+p+")"})
	
	svg.append("text")
		.attr("x", opx+ow*((horizontal ? 0 : perc)+.02))
		.attr("y", opy+oh*((horizontal ? perc : 0)+.07))
		.style({"font-family": '"Open Sans",sans-serif', "font-weight": 100})
		.text(pPropertiesName[p])
	
}

function Particle(pNo) {
	var p = this
	p.pNo = pNo
	for (var i=0; i<pProperties.length; i++) {
		p[pProperties[i]] = {
			_: gMean[pProperties[i]]+((Math.random()-0.5)*3)*gVar[pProperties[i]],
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
			pls.shift().obj.deleteParticle()
		} else {
			var p = new Particle(numberOfParticles+i)
			pls.push(p)
			// particles in front are brighter
			var lvar = gVar.l/255
			p.l._ *= ((1-lvar)+i/numberOfParticles*(lvar*2))
		}
	}
	
	for (var i=0; i<pProperties.length; i++)
		// lightness is bound to z-index
		if (pProperties[i] !== "l")
			step(pProperties[i])
	
	// additional constrains
	for (var i=0; i<pls.length; i++) {
		// increasing radius decreases opacity and increases blur
//		var rAct = pls[i].r.activity
//		if (rAct > 0 && pls[i].r.activityRounds > 0) {
//			pls[i].a.acc -= rAct*globalActivityFactor*gVar.a/10
//			pls[i].g.acc += rAct*globalActivityFactor*gVar.g
//		}
		// increasing sharpness decreases opacity
//		var gAct = pls[i].g.activity
//		if (gAct < 0 && pls[i].g.activityRounds > 0) {
//			pls[i].a.acc -= gAct*globalActivityFactor*gVar.a/10
//		}
	}

	log.updateLog()
	for(var prop in distributionSliders)
		distributionSliders[prop].updateParticles()
	
	for (var i=0; i<pls.length; i++) {
		var p = pls[i]

		function applyTransition(obj) {
			if (transitionDuration !== 0) {
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

		if (transitionDuration !== 0 && i === pls.length-1)
			t.each("end", progressParticleSystem)
	}
	// lets the browser render, then restarts
	if (transitionDuration === 0)
		setTimeout(progressParticleSystem, 20)
}

function step(attr) {
	var currentMean = mean(plsList(attr))
	var currentVariance = variance(plsList(attr))
	var pSpan = gMax[attr] - gMin[attr]
	var relativeDifferenceToGoalMean = (gMean[attr] - currentMean) / pSpan
	// positive for spreading, negative for contraction
	var relativeDifferenceToGoalVariance = (gVar[attr] - currentVariance) / pSpan
	var currentMeanVelocity = mean(plsList(attr, "v"))
	// linear prediction
	// steps it takes @ current v to reach goal Mean
	// the less steps to go, the more I dampen acceleration
	var prediction = currentMeanVelocity === 0 ? 1000
		: (gMean[attr] - currentMean)/currentMeanVelocity
	
	// maximum min-max-span of all properties
	var maxPspan = 0
	for (var i=0; i<pProperties.length; i++) {
		var p = pProperties[i]
		var span = gMax[p] - gMin[p]
		if (maxPspan < span)
			maxPspan = span
	}
	const accBaseScaled = accDeltaAbsMax * pSpan / maxPspan
	
	if (Math.random() < triggerActivityPropability * numberOfParticles) {
		var randomP = pls[Math.round(Math.random()*(pls.length-1))]
		
		randomP[attr].activity = (Math.random()-0.5)
		randomP[attr].activityRounds += Math.round(Math.random()*activityRoundsMax)
		// couple movements
		if (attr === "x" || attr === "y")
			randomP[attr === "x" ? "y" : "x"].activityRounds += Math.round(Math.random()*activityRoundsMax)
		// the closest circles (z-index) should have a small radius
		// TODO
//		if (attr === "r")
//			p[attr].activity += p.pNo/numberOfParticles/3
	}
	
	for (var i=0; i<pls.length; i++) {
		var pa = pls[i][attr]
		// pulls all particles to goal mean (with same acceleration)
		var accDelta = accBaseScaled*relativeDifferenceToGoalMean
		// dampen acceleration based on linear prediction
		if (prediction >= 0 && prediction <= predDampen)
			accDelta = 0
		if (prediction > predDampen)
			accDelta *= 1-predDampen/prediction
		
		// spread or contract around current mean to reach goal variance
		// currentVariance may be 0
		
		var localRelativeDifferenceToCurrentMean = currentVariance == 0 ? 0
			: (currentMean - pa._) / currentVariance
		accDelta -= accBaseScaled * 0.8
			* relativeDifferenceToGoalVariance
			* localRelativeDifferenceToCurrentMean
		
		// add random activity
		if (pa.activityRounds > 0) {
			pa.activityRounds--
			accDelta += accBaseScaled
				* globalActivityFactor
				* pa.activity
				* (gVar[attr]/pSpan)
		}
		
		
		// accelerate to reach goal variance
//		var localDifferenceToCurrentMean = pa._ - mean_
//		var cor_var_sign = (var_ < gVar[attr] && localDifferenceToCurrentMean > 0)
//			|| (var_ > gVar[attr] && localDifferenceToCurrentMean < 0) ? 1 : -1
//		if (Math.abs(dVar) > 3
//			&& ((cor_var_sign > 0 && mean_v <= 0)
//			|| (cor_var_sign < 0 && mean_v >= 0)))
//			accDelta += cor_var_sign * 0.01
		
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

function updateParticleSymbolSVG() {
	var li_p_svg = d3.select("#li_p_svg")
	var curPlist = d3.selectAll("#li_p_svg use")[0]
	// remove if too many
	for (var i=0; i<curPlist.length-numberOfParticles; i++) {
		curPlist[i].remove()
	}
	// add if missing
	for (var i=0; i<numberOfParticles-curPlist.length; i++) {
		var cr = 40
		// in polar coordinates
		var theta = (Math.random()-.5)*Math.PI*2
		var r = Math.random()*cr
		var x = r*Math.sin(theta)
		var y = r*Math.cos(theta)
		
		li_p_svg.append("use")
			.attr("x", x+50).attr("y", y+50)
			.attr("xlink:href", "#s1")
	}
}

function setUpSVG() {
	var svg = d3.select("#bokehSvg")
	svg.attr("viewBox", "0 0 "+svgViewboxWidth+" "+svgViewboxHeight)
	setSVGSizeInWindow()
	svg.append("defs")

	svg.append("rect")
		.attr("id", "backgroundRect")
		.attr("x", 0)
		.attr("y", 0)
		.attr("width", "100%")
		.attr("height", "100%")
		.style("fill", d3.hsl(bgColor.h/255*360, bgColor.s/255, bgColor.l/255) )
		.style("fill-opacity", bgColor.a)
		
	svg.append("g").attr("id", "particlesGroup")
	
	// in chrome, the svg viewbox aspect is not honored. the svg is stretched to
	// width and height 100% of the parent and "overflow" (objects outside of the viewbox)
	// are visible
	// surround viewbox with white rectangles
	var viewboxWhiteFrame = svg.append("g").attr("id", "viewboxWhiteFrame")
	viewboxWhiteFrame.append("rect").attr("x", "100%").attr("y", "-100%").attr("width", "100%").attr("height", "300%").style("fill", "#fff" )
	viewboxWhiteFrame.append("rect").attr("x", "-100%").attr("y", "-100%").attr("width", "100%").attr("height", "300%").style("fill", "#fff" )
	viewboxWhiteFrame.append("rect").attr("x", "0%").attr("y", "-100%").attr("width", "100%").attr("height", "100%").style("fill", "#fff" )
	viewboxWhiteFrame.append("rect").attr("x", "0%").attr("y", "100%").attr("width", "100%").attr("height", "100%").style("fill", "#fff" )
	
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
	var c = d3.select("#particlesGroup").append("circle")
	var filterName = Math.random().toString(36).substring(7)
	c.filter = d3.select("#bokehSvg defs")
		.append("filter")
		.attr("id", filterName)
		.attr("x", -3)
		.attr("y", -3)
		.attr("width", 8)
		.attr("height", 8)
	c.feGaussianBlur = c.filter.append("feGaussianBlur")
		.attr("stdDeviation", g)
	
	c.attr("cx", 0)
		.attr("cy", 0)
		.attr("r", r)
		.attr("transform", "translate("+x+", "+y+")") //  scale("+1+")
		.style({
			"fill": d3.hsl(h/255*360, s/255, l/255),
			"fill-opacity": a,
			"filter": "url(#"+filterName+")"
		})
	c.deleteParticle = function() {
		c.filter.remove()
		c.remove()
	}
	return c
}

function round(number) {
	return Number(number.toFixed(1))
}

function openSVG() {
	var svg = document.getElementById("bokehSvg")
	var prev = SVGsizeInWindow
	setSVGSizeInWindow(3)
	window.open("data:image/svg+xml," + encodeURIComponent(
	// http://stackoverflow.com/questions/1700870/how-do-i-do-outerhtml-in-firefox
		svg.outerHTML || new XMLSerializer().serializeToString(svg)
	))
	setSVGSizeInWindow(prev)
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
	d3.select("#bokehSvg")
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

function toogleMenuEntrySticky(p) {
	var ds = d3.select("#li_"+p)
	ds.classed("toggledOn", !ds.classed("toggledOn"))
}

bokeh.clickHue = function() { toogleMenuEntrySticky("h") }
bokeh.clickSaturation = function() { toogleMenuEntrySticky("s") }
bokeh.clickGamma = function() { toogleMenuEntrySticky("g") }
bokeh.clickAlpha = function() { toogleMenuEntrySticky("a") }
bokeh.clickRadius = function() { toogleMenuEntrySticky("r") }
bokeh.clickBackground = function() { toogleMenuEntrySticky("bg") }

bokeh.clickDownload = function() { openSVG() }

return bokeh
}()
