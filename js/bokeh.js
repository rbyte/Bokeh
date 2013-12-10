
bokeh = function() { // spans everything - not indented
var bokeh = {}

bokeh.init = function () {
	var svg = d3.select("#svg")
	var c = circle(svg, 350, 350, 1)
	circle(svg, 300, 300, 1)
	
//	if (false)
	d3.select("#feGaussianBlur3765")
		.transition()
		.duration(5000)
		.attr("stdDeviation", 10)
	
	c
		.transition()
		.duration(5000)
		.style("fill", hsl255ToHex(140, 133, 255))
		.attr("transform", "translate("+500+", "+700+") scale("+2+")")
	
	saveSVGshortcut()
}

function circlePath(a) {
	// http://www.w3.org/TR/SVG/paths.html#PathDataEllipticalArcCommands
	return "m "+a+",0 a "
		+a+","+a+" 0 1 1 -"+2*a+",0 "
		+a+","+a+" 0 1 1  "+2*a+",0 z"
}

function circle(svg, x, y, scale) {
	var a = 60
	var c = svg.append("path")
		.attr("d", circlePath(a))
		.attr("transform", "translate("+x+", "+y+") scale("+scale+")")
		.style({
			"fill": hsl255ToHex(140, 133, 197),
			"fill-opacity": 0.6,
			"stroke": hsl255ToHex(140, 133, 228),
			"stroke-opacity": 1,
			"stroke-width": 1.5,
			"filter": "url(#filter3763)"
		})
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
function hslToRgb(h, s, l){
    var r, g, b
	
    if (s === 0 || l === 1 || l === 0) {
        r = g = b = l // achromatic
    } else {
        function hue2rgb(p, q, t){
            if(t < 0) t += 1
            if(t > 1) t -= 1
            if(t < 1/6) return p + (q - p) * 6 * t
            if(t < 1/2) return q
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6
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

