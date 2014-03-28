/*
	Bokeh
	Copyright (C) 2014 Matthias Graf
	matthias.graf <a> eclasca.de
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

bokeh = function() { // spans everything - not indented
var bokeh = {}

var svgViewboxWidth = 400
var svgViewboxHeight = 300

var pProperties = ["h","s","l","a","g","x","y","r"]
var pPropertiesName = {
	h: "Hue", s: "Saturation", l: "Lightness", a: "Opacity",
	g: /*Gauss Smoothing*/ "Blur", x: "Horizonal Position",
	y: "Vertical Position", r: "Radius"}

// defaults
var gMean=	{h: 140,s: 220,	l: 190,	a: .22,	g: .070,x: .5,	y: .5,	r: .15}
var gVar=	{h: 4,	s: 8,	l: 15,	a: .02,	g: .025,x: .22,	y: .22,	r: .07}
var gMin=	{h: 0,	s: 0,	l: 0,	a: .04,	g: .001,x: -.2,	y: -.2,	r: .01, transitionDuration: 0, numberOfParticles: 1, SVGsizeInWindow: 0.005}
var gMax=	{h: 255,s: 255,	l: 255,	a: .8,	g: .16,	x: 1.2,	y: 1.2,	r: .45, transitionDuration: 1000, numberOfParticles: 100, SVGsizeInWindow: 2}
var zDep=	{h: 0,	s: 0,	l: 1,	a: 1,	g: -1,	x: 0,	y: 0,	r: -1}
// zDep is z-index dependency of attribute: direction and factor
// blur and radius shall increase for particles in the back,
// while lightness and alpha increase for particles in the front

var arr = [gMean, gVar, gMin, gMax]
arr.forEach(function(e) {
    e.g *= svgViewboxWidth
	e.x *= svgViewboxWidth
	e.y *= svgViewboxHeight
	e.r *= svgViewboxWidth
})

// stddeviation/g=0 is not supported in inkscape (circles will not show)
if (/*disableBlur = */ false)
	gMax.g = gMin.g = 0

var bgColor={h: 151,s: 120,	l: 90,	a: 1}
var bgColorMax={h: 255,s: 255,	l: 255,	a: 1}
var distributionSliders = {}
var log = {}
//log.items = [["h", "_", "mean"], ["h", "_", "var"]]
//log.items = [["g", "_", "mean"], ["r", "_", "mean"],["a", "_", "mean"], ["x", "_", "mean"], ["y", "_", "mean"]]
log.items = []

var pls = [] // particle list
var SVGsizeInWindow = 0.15 // percent
var numberOfParticles = 25
// if 0, no transition is triggered (just steps)
var transitionDuration = 0
const kissenSize = 0.02 // [0, 0.5]
const globalActivityFactor = 1 // 4 is violent
const activityRoundsMax = 200
const accDeltaAbsMax = 0.25
const triggerActivityPropability = 0.1
const predDampen = 9
const fontFamily = '"Open Sans Light", "Open Sans", sans-serif';

var pauseStepping = false
var numberOfStickyMenuEntries = 0
var lastStep
var timeDeltaBetweenSteps = []
var lastFPSupdate
var menuElementsAreHidden = false

bokeh.run = function () {
	window.onresize = function(event) {
		updateScreenElemsSize()
	}
	window.onresize()
	
	setUpSVG()
	log.init()
	setUpSliders()
	setUpKShortcuts()
	progressParticleSystem("for the first time")
}

function updateScreenElemsSize() {
	var winW = document.body.clientWidth
	var winH = window.innerHeight
	var size = Math.round((winW < winH ? winW : winH))
	
	d3.select("#title").attr("style", "font-size: "+size+"% !important;")
	
	var menuSymbolBaseSize = size * 0.06
	// the more items are sticky, the smaller all get, in order to fit
	var menuSymbolEnlargedSize = menuSymbolBaseSize*(3.6-Math.max(1,numberOfStickyMenuEntries)/3)
	// https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration
	var mainCss = document.styleSheets[0]
	var cssRules = mainCss.cssRules ? mainCss.cssRules : mainCss.rules
	for (var i=0; i<cssRules.length; i++) {
		if (cssRules[i].selectorText === '.mLeft li:hover img, .mLeft li:hover .symbolSVG, .toggledOn img, .toggledOn .symbolSVG') {
			cssRules[i].style.setProperty("width", menuSymbolEnlargedSize+"px", "important")
			cssRules[i].style.setProperty("height", menuSymbolEnlargedSize+"px", "important")
		}
		if (cssRules[i].selectorText === '.menu li img, .menu li .symbolSVG') {
			cssRules[i].style.setProperty("width", (menuSymbolBaseSize)+"px")
			cssRules[i].style.setProperty("height", (menuSymbolBaseSize)+"px")
		}
	}
	// those are set in the js after the dynamic size has been set: avoids shacking on startup
	// wait until CSS changes are flushed
	setTimeout(function() {
		for (var i=0; i<cssRules.length; i++) {
			if (cssRules[i].selectorText === '.mLeft .liKasten, .mLeft .liKasten svg, .mLeft li, .mLeft li img, .mLeft li .symbolSVG') {
				cssRules[i].style.setProperty("transition", "all 500ms ease-in-out")
			}
			if (cssRules[i].selectorText === 'mRight .liKasten, .mRight .liKasten svg, .mRight li, .mRight li img, .mRight li .symbolSVG') {
				cssRules[i].style.setProperty("transition", "all 100ms ease-in-out")
			}
		}
	}, 300)
}

function setUpSliders() {
	var sliders = ["h", "s", "l", "a", "g", "r"]
	sliders.forEach(function(e) {
		setUpDistributionSlider(e)
	})
	
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
		d3.selectAll("#bg"+pName+", #bg"+pName+"Slider")
			.call(d3.behavior.drag().on("drag", function (d) {
//			console.log(d3.event.x)
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
		var svgText = d3.select("#"+e+"_myFader text")
		var faderForeground = d3.select("#"+e+"_myFader .faderForeground")
		var rX = eval(e) / gMax[e]
		svgText.updateText = function() {}
		if (e === "numberOfParticles") {
			svgText.updateText = function() {
				this.text("Particles: "+numberOfParticles)
			}
		}
		if (e === "transitionDuration") {
			rX = 1 - rX
			d3.selectAll(".sizeSVGspeedIndicator").style({"stroke-opacity": rX})
			svgText.updateText = function() {
				this.text("Speed: "+Math.round((1-transitionDuration/gMax[e])*100)+"%")
			}
		}
		if (e === "SVGsizeInWindow") {
			svgText.updateText = function() {
				this.text("Size: "+Math.round(SVGsizeInWindow*100)+"%")
			}
		}
		svgText.updateText()
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
				d3.selectAll(".sizeSVGspeedIndicator").style(
					{"stroke-opacity": rX})
				pause(rX === 0)
			}
			if (e === "SVGsizeInWindow") {
				SVGsizeInWindow = Math.max(gMin[e], rX*gMax[e])
				setSVGSizeInWindow(SVGsizeInWindow)
			}
			svgText.updateText()
			knob.attr("cx", rX*barW)
			faderForeground.attr("width", rX*barW)
		}))
	})
}

function bound(l, x, h) { return Math.max(Math.min(x, h), l) }

function setUpDistributionSlider(p) {
//	var svg = d3.select("#distSliderSVG")
	// outer rectangle, that contains everything
	distributionSliders[p] = {}
	
	const opx = 0, opy = 0, ow = 300, oh = 100,
	// percent of width the scale takes
	perc = .1,
	// TODO false does not work yet
	horizontal = true,
	// the drag area rectangle (a portion of outer)
	px = opx+(horizontal ? 0 : ow*perc),
	py = opy,
	w = ow*(horizontal ? 1 : 1-perc),
	h = oh*(horizontal ? 1-perc : 1),
	varianceOfVrc = .375,
	toGroundCutoff = .2,
	varFactorIntoPath = 5,
	stdMargin = .01,
	left = horizontal ? stdMargin : toGroundCutoff,
	right = stdMargin,
	top = stdMargin,
	bottom = horizontal ? toGroundCutoff :stdMargin,
	topSpan = .3, baseSpan = .8, varianceSpan = .2
	
	var wasDraggedOnce = false
	var peakX, peakY
	
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
		var horBasePointX = (px+(rX - vrcUp)*w)
		peakX = horBasePointX+vrcUp*w
		peakY = rY*h
		
		var horizontalPath = ("M"+px+","+py+h
			// upper base point
			+" L"+horBasePointX+","+(py+h)
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
		
		var verticalPath = ("M"+px+","+py
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
		
		return (horizontal ? horizontalPath: verticalPath)
	}
	
	distributionSliders[p].updateParticles = function() {
		if (distributionSliders[p].dssvgg !== undefined)
			distributionSliders[p].dssvgg.remove()
		distributionSliders[p].dssvgg = svg
			.append("g").attr("id", "distSliderSVGcircles")
		
		if (p === "h")
			d3.selectAll(".lgrad_hueDependentColour").style({"stop-color":
				d3.hsl(gMean.h/255*360, 255/255, 127/255)})
		if (p === "s")
			d3.selectAll(".lgrad_saturationDependentColour").style({"stop-color":
				d3.hsl(gMean.h/255*360, gMean.s/255, 127/255)})
		if (p === "l")
			d3.selectAll(".lgrad_lightnessDependentColour").style({"stop-color":
				d3.hsl(gMean.h/255*360, gMean.s/255, gMean.l/255)})
		if (p === "g")
			d3.select("#li_g_svg_feGaussianBlur")
				.attr("stdDeviation", Math.sqrt((gMean.g-gMin.g) / (gMax.g-gMin.g))*50)
		if (p === "a") {
			var val = 0.35 + (gMean.a-gMin.a) / (gMax.a*3-gMin.a)
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
	if (p == "l") {
		var lightness = defs.append("linearGradient").attr("id", "lgrad_l_"+p)
		lightness.append("stop").style({"stop-color": "#000"}).attr("offset", 0)
		lightness.append("stop").style({"stop-color": "#f00"}).attr("offset", .5).attr("class", "lgrad_hueDependentColour lgrad_saturationDependentColour")
		lightness.append("stop").style({"stop-color": "#fff"}).attr("offset", 1)
	}
	if (p == "a") {
		var alpha = defs.append("linearGradient").attr("id", "lgrad_a_"+p)
		alpha.append("stop").style({"stop-color": "#888", "stop-opacity": ".1"}).attr("offset", 0)
			.attr("class", "lgrad_hueDependentColour lgrad_saturationDependentColour lgrad_lightnessDependentColour")
		alpha.append("stop").style({"stop-color": "#f00"}).attr("offset", 0.96)
			.attr("class", "lgrad_hueDependentColour lgrad_saturationDependentColour lgrad_lightnessDependentColour")
			
		var alphaPattern = defs.append("pattern").attr("id", "alphaPattern_"+p)
			.attr("width", 5).attr("height", 5).attr("x", 0).attr("y", 0).attr("patternUnits", "userSpaceOnUse")
		alphaPattern.append("rect").style({"fill": "#fff"}).attr("x", 0).attr("y", 0).attr("width", 2.5).attr("height", 2.5)
		alphaPattern.append("rect").style({"fill": "#aaa"}).attr("x", 2.5).attr("y", 0).attr("width", 2.5).attr("height", 2.5)
		alphaPattern.append("rect").style({"fill": "#aaa"}).attr("x", 0).attr("y", 2.5).attr("width", 2.5).attr("height", 2.5)
		alphaPattern.append("rect").style({"fill": "#fff"}).attr("x", 2.5).attr("y", 2.5).attr("width", 2.5).attr("height", 2.5)
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
		if (!wasDraggedOnce) {
			d3.selectAll(".dragIndicationTriangle, .dragIndicationText, .distributionText")
				.transition()
				.duration(600)
				.style({"fill-opacity": 0, "stroke-opacity": 0})
				.remove()
			
			wasDraggedOnce = true
		}
		distributionCurve.attr("d", getPath(d3.event.x, d3.event.y))
	}
	
	var meanDim = (gMean[p] - gMin[p]) / (gMax[p]-gMin[p])
	var varDim = gVar[p] / (gMax[p]-gMin[p]) * varFactorIntoPath
	var dPeakX = px+w*(horizontal ? meanDim : 1-varDim)
	var dPeakY = py+h*(horizontal ? varDim : meanDim)
	
	var distributionCurve = svg.append("path")
		.attr("class", "distributionCurve")
		.attr("d", getPath( 
			dPeakX,
			dPeakY))
		.style({'fill': "url(#lgradVert_"+p+")"})
		.call(drag)
	
	// produces the opacity background pattern
	if (p === "a")
		svg.append("rect")
			.attr("width", ow)
			.attr("height", oh*perc)
			.attr("x", opx)
			.attr("y", opy+(1-perc)*oh)
			.style({'fill': "url(#alphaPattern_"+p+")"})
	
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
		.style({"font-family": fontFamily, "font-weight": 100})
		.text(pPropertiesName[p])
	
	svg.append("text")
		.attr("class", "distributionText")
		.attr("x", opx+ow*((horizontal ? 0 : perc)+.02))
		.attr("y", opy+oh*((horizontal ? perc : 0)+.20))
		.style({"font-family": fontFamily, "font-size": "50%",
			"font-weight": 100, "fill": "#777"})
		.text("distribution")
		
	svg.append("path")
		.attr("class", "dragIndicationTriangle")
		.style({'fill': "#777"}) // , stroke: "#333", "stroke-width": .4
		.attr("d",
		  "M"+(peakX+13)+","+(peakY+3)
		+" L"+(peakX+13)+","+(peakY+7)
		+" L"+(peakX+8)+","+(peakY+5)+" Z")
	
	svg.append("text")
		.attr("class", "dragIndicationText")
		.attr("x", peakX+16)
		.attr("y", peakY+8)
		.style({"font-family": fontFamily, "font-size": "50%", "font-weight": 100})
		.text("drag")
}

function Particle(pNo) {
	var p = this
	p.pNo = pNo
	for (var i=0; i<pProperties.length; i++) {
		var pp = pProperties[i]
		var random = randomPressuredIntoZ_Order(pNo, pp)
		p[pp] = {
			_: bound(gMin[pp], gMean[pp]+(random*4)*gVar[pp], gMax[pp]),
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

function progressParticleSystem(firstTime) {
	if (pauseStepping)
		return

	updateFpsCounter()
	
	for (var i=1; pls.length - numberOfParticles !== 0; i++) {
		if (pls.length > numberOfParticles) {
			pls.shift().obj.deleteParticle()
		} else {
			pls.push(new Particle(pls.length))
		}
	}
	
	// the initial distribution is not very good, so ...
	if (firstTime !== undefined)
		bokeh.roleTheDice()
	
	for (var i=0; i<pProperties.length; i++)
		step(pProperties[i])
	
	log.updateLog()
	for(var prop in distributionSliders)
		distributionSliders[prop].updateParticles()
	
	var writeToConsole = false
	if (writeToConsole)
		console.clear()
	for (var i=0; i<pls.length; i++) {
		var p = pls[i]
		if (writeToConsole)
			console.log(p.pNo+": g "+Math.round(p.g._)
				+",\tr "+Math.round(p.r._)
				+",\tl "+Math.round(p.l._)
				+",\ta "+Math.round(p.a._*255))
		
		function applyTransition(obj) {
			if (transitionDuration !== 0) {
				obj = obj.transition()
					.duration(transitionDuration)
					.ease(d3.ease("linear"))
			}
			return obj
		}
		
		// larger particles have larger blur
		applyTransition(p.obj.feGaussianBlur)
			.attr("stdDeviation", p.g._) // *(p.r._/gMax.r*0.95+0.05)
		
		applyTransition(d3.select("#backgroundRect"))
			.style("fill", d3.hsl(bgColor.h/255*360, bgColor.s/255, bgColor.l/255) )
			.style("fill-opacity", bgColor.a)
		
		var t = applyTransition(p.obj)
			.style("fill", d3.hsl(p.h._/255*360, p.s._/255, p.l._/255) )
			// larger particles have lower opacity
			.style("fill-opacity", p.a._) // *(1 - p.r._/gMax.r*0.5)
			.attr("r", p.r._)
			.attr("transform", "translate("+p.x._+", "+p.y._+")")

		if (transitionDuration !== 0 && i === pls.length-1)
			t.each("end", progressParticleSystem)
	}
	// lets the browser render, then restarts
	if (transitionDuration === 0)
		setTimeout(progressParticleSystem, 20)
}

function randomPressuredIntoZ_Order(pNo, attr) {
	var x = Math.random()-.5
	var factor = zDep[attr]
	if (factor === 0)
		return x
	var multiplier = (factor < 0 ? -1 : 1) * Math.pow(pNo/numberOfParticles, 1/Math.abs(factor))
	if (x > 0)
		x *= multiplier
	else
		x *= 1-multiplier
	return x
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
	// steps it takes @ current velocity to reach goal Mean
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
		randomP[attr].activity = randomPressuredIntoZ_Order(randomP.pNo, attr)
		randomP[attr].activityRounds += Math.round(Math.random()*activityRoundsMax)
		// couple x & y movements
		if (attr === "x" || attr === "y")
			randomP[attr === "x" ? "y" : "x"].activityRounds += Math.round(Math.random()*activityRoundsMax)
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
		// this also pressures outliers towards mean
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
		// these settings can immensely improve performce
		.attr("x", -3)
		.attr("y", -3)
		.attr("width", 8)
		.attr("height", 8)
		// blocks visible ...
//		.attr("x", 0)
//		.attr("y", 0)
//		.attr("width", 1)
//		.attr("height", 1)
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

function pause(y) {
	if (!y && pauseStepping) { // reinitiate
		pauseStepping = y
		progressParticleSystem()
	}
	pauseStepping = y
}

function setSVGSizeInWindow(percent) {
	if (percent !== undefined)
		SVGsizeInWindow = Math.max(percent, gMin.SVGsizeInWindow)
	// 1/3* because the wrappers size is 300%
	// this allows the zooming of the svg beyond the page borders
	d3.select("#bokehSvg")
		.style("max-height", 1/3*100*SVGsizeInWindow+"%")
		.style("max-width", 1/3*100*SVGsizeInWindow+"%")
}

bokeh.roleTheDice = function() {
	// step without drawing, fast forwarding particle system to random state
	for (var k=0; k<100; k++)
		for (var i=0; i<pProperties.length; i++)
			step(pProperties[i])
}

function toogleMenuEntrySticky(p) {
	var ds = d3.select("#li_"+p)
	var y = !ds.classed("toggledOn")
	ds.classed("toggledOn", y)
	numberOfStickyMenuEntries += y ? 1 : -1
	window.onresize()
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

function openAsPNG() {
	var widthPxDefault = 800
	var widthPx = widthPxDefault
	var url = prompt("PNG width in pixels:", widthPxDefault)
	try {
		widthPx = Math.max(10, Math.abs(parseInt(url)))
	} catch(e) {
		widthPx = widthPxDefault
	}
	
	var canvas = document.getElementById("savePngHelperCanvas")
	var context = canvas.getContext("2d")
	var heightPx = widthPx*svgViewboxHeight/svgViewboxWidth
	canvas.setAttribute("width", widthPx)
	canvas.setAttribute("height", heightPx)
	
	var svg = document.getElementById("bokehSvg")
	svg.setAttribute("width", widthPx)
	svg.setAttribute("height", heightPx)
	var data = svg.outerHTML || new XMLSerializer().serializeToString(svg)
	svg.removeAttribute("width")
	svg.removeAttribute("height")
	
	var img = new Image()
	img.onload = function() {
		context.drawImage(img, 0, 0)
		try {
			// does not work in chrome because the canvas is "tainted" by the svg input
			// http://stackoverflow.com/questions/2390232/why-does-canvas-todataurl-throw-a-security-exception
			window.open(canvas.toDataURL('image/png'))
		} catch(e) {
			alert("Not supported by your browser! Sorry.")
		}
		context.clearRect(0, 0, widthPx, heightPx)
	}
	//img.src = "hue2.svg"
	img.src = "data:image/svg+xml,"+encodeURIComponent(data)
}

function switchFullscreen() {
	menuElementsAreHidden = !menuElementsAreHidden
	var mainCss = document.styleSheets[0]
	var cssRules = mainCss.cssRules ? mainCss.cssRules : mainCss.rules
	for (var i=0; i<cssRules.length; i++) {
		if (cssRules[i].selectorText === '.menu') {
			cssRules[i].style.setProperty("opacity", menuElementsAreHidden ? 0 : 1)
		}
	}
	
	if (menuElementsAreHidden) {
		// TODO update size slider
		var winW = document.body.clientWidth
		var winH = window.innerHeight
		var ratioDiff = winW/winH - svgViewboxWidth/svgViewboxHeight
		setSVGSizeInWindow(1+Math.abs(ratioDiff))
	}
}

function setUpKShortcuts() {
	// prevents text selection and alternation of cursor in chrome during drag
	document.onselectstart = function(){ return false; }
	
	function scrollMouseWheelOnBokehSvgHandler(e) {
		var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)))
		setSVGSizeInWindow(SVGsizeInWindow*(1+.1*delta))
	}
	
	var bokehSvg = document.getElementById("bokehSvg")
	if (bokehSvg.addEventListener) {
		// IE9, Chrome, Safari, Opera
		bokehSvg.addEventListener("mousewheel", scrollMouseWheelOnBokehSvgHandler, false)
		// Firefox
		bokehSvg.addEventListener("DOMMouseScroll", scrollMouseWheelOnBokehSvgHandler, false)
	}
	
	document.addEventListener("keydown", function (evt) {
		switch(evt.keyCode) {
			case 83: /*s*/ openSVG(); break
			case 68: /*d*/ bokeh.roleTheDice(); break
			case 69: /*e*/ pause(!pauseStepping); /*switch*/ break
			case 70: /*f*/ switchFullscreen(); break
			case 71: /*g*/  break
			case 107:/*+*/ setSVGSizeInWindow(SVGsizeInWindow*1.1); break
			case 109:/*-*/ setSVGSizeInWindow(SVGsizeInWindow*0.9); break
		}
	}, false)
}

bokeh.clickHue = function() { toogleMenuEntrySticky("h") }
bokeh.clickSaturation = function() { toogleMenuEntrySticky("s") }
bokeh.clickLightness = function() { toogleMenuEntrySticky("l") }
bokeh.clickGamma = function() { toogleMenuEntrySticky("g") }
bokeh.clickAlpha = function() { toogleMenuEntrySticky("a") }
bokeh.clickRadius = function() { toogleMenuEntrySticky("r") }
bokeh.clickBackground = function() { toogleMenuEntrySticky("bg") }
bokeh.clickDownload = function() { openSVG() }
bokeh.clickDownloadPNG = function() { openAsPNG() }

return bokeh
}()
