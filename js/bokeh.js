
bokeh = function() { // spans everything - not indented
var bokeh = {}


bokeh.init = function () {
	var svg = d3.select("#svg")
	
	var c = new Particle(svg, 350, 350, 60, 140, 133, 197, 0.6, 5)
	var c2 = new Particle(svg, 300, 300, 60, 140, 133, 197, 0.6, 5)
	
	var psys = new PSystem()
	psys.addParticle(new Particle(svg, 650, 650, 60, 140, 133, 197, 0.6, 5))
	psys.addParticle(new Particle(svg, 500, 650, 60, 140, 133, 197, 0.6, 5))
	psys.addParticle(new Particle(svg, 650, 500, 60, 140, 133, 197, 0.6, 5))
	psys.addParticle(new Particle(svg, 500, 500, 60, 140, 133, 197, 0.6, 5))
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
	
	self.obj = circleSimple(svg,x,y,r,h,s,l,a)
	
}

function PSystem() {
	var self = this
	
	// averages/means
	var mean_numberOfParticles = 10
	var mean_h = 141 // 124 - 183 sind so schmerzgrenzen
	var mean_s = 180
	// the higher layers (z-index) are always brigther (!)
	// feBlend screen may be an alternative
	var base_l = 90
	var mean_a = 200
	
	// rather smaller for upper layers
	// could also scale with transform, but this also has downsides
	var mean_r = 50
	// rather higher for higher radius
	var mean_g = 30
	
	// variance
	var var_numberOfParticles
	var var_h = 10
	var var_s = 30
//	var var_l 
	var var_a = 30
	
	var var_r = 200
	var var_g = 30
	
	var plist = []
	
	self.start = function() {
		
	}
	
	self.addParticle = function(particle) {
		plist.push(particle)
	}
	
	self.variance = function(vals) {
		var mean = self.mean(vals)
		var newVals = []
		for (var i=0; i<vals.length; i++) {
			var a = vals[i]-mean
			newVals.push(a*a)
		}
		return self.mean(newVals)
	}
	
	self.mean = function(vals) {
		return self.sum(vals)/vals.length
	}
	
	self.sum = function(vals) {
		var sum = 0
		for (var i=0; i<vals.length; i++) {
			sum = vals[i]
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