/**
 * bigpicture.custom.js — Steam 2.0 Modular
 * @description Styles Big Picture Mode (BPM).
 *
 * Reads color config from localStorage (written by libraryroot.custom.js)
 * and injects CSS for the BigPicture section into this CEF frame.
 * Listens to the "storage" event to update in real time when the user
 * changes colors in the Colors modal.
 */

;(function () {
  const CONFIG_KEY  = "steam_color_config_v1"
  const SECTION_KEY = "BigPicture"
  const STYLE_ID    = "bp-color-override"

  function hexAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
    return `rgba(${r},${g},${b},${alpha??1})`
  }

  function gradient(colors, angle) {
    const n = Math.max(colors.length-1,1)
    return `linear-gradient(${angle}deg,${colors.map((c,i)=>`${hexAlpha(c.hex,c.alpha)} ${Math.round(i/n*100)}%`).join(",")})`
  }

  function radial(colors) {
    const n = Math.max(colors.length-1,1)
    return `radial-gradient(circle at var(--bp-cx,50%) var(--bp-cy,50%),${colors.map((c,i)=>`${hexAlpha(c.hex,c.alpha)} ${Math.round(i/n*100)}%`).join(",")})`
  }

  let raf = null
  function cancelLoop() { if (raf) { cancelAnimationFrame(raf); raf = null } }

  function apply() {
    cancelLoop()

    let section
    try { section = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}")?.[SECTION_KEY] }
    catch(_) { section = null }
    if (!section?.colors?.length) return

    const { colors, angle=135, animation:anim="none", speed=4, selector:_ignored } = section
    const sel = "._3LYP1SIxyoky-yW9Ug_1fq.b084mAvY8rgVMr3H04g9g:is(#GamepadUI_Full_Root, #popup_target *)"

    let style = document.getElementById(STYLE_ID)
    if (!style) { style = document.createElement("style"); style.id = STYLE_ID; document.head.appendChild(style) }

    const grad = gradient(colors, angle)

    if (anim === "none") {
      style.textContent = `${sel}{background-image:${grad}!important;background-attachment:fixed!important}`

    } else if (anim === "rotate") {
      style.textContent = `
        @keyframes bp-rot{0%{filter:hue-rotate(0deg)}100%{filter:hue-rotate(360deg)}}
        ${sel}{position:relative!important;isolation:isolate!important}
        ${sel}::before{content:""!important;position:fixed!important;inset:0!important;z-index:-1!important;
          background-image:${grad}!important;animation:bp-rot ${speed}s linear infinite!important;pointer-events:none!important}
        ${sel}>*{position:relative!important;z-index:1!important}`

    } else if (anim === "radial") {
      style.textContent = `
        ${sel}{position:relative!important;isolation:isolate!important;--bp-hue:0deg;--bp-cx:50%;--bp-cy:50%}
        ${sel}::before{content:""!important;position:fixed!important;inset:0!important;z-index:-1!important;
          background-image:${radial(colors)}!important;filter:hue-rotate(var(--bp-hue))!important;pointer-events:none!important}
        ${sel}>*{position:relative!important;z-index:1!important}`
      const ms = speed * 1000
      function tick(ts) {
        const hue = ((ts % ms) / ms * 360).toFixed(1)
        document.querySelectorAll(sel).forEach(el => {
          el.style.setProperty("--bp-hue", `${hue}deg`)
          const r = el.getBoundingClientRect()
          if (r.width && r.height) {
            el.style.setProperty("--bp-cx", `${(Math.min(Math.max(innerWidth/2-r.left,0),r.width)/r.width*100).toFixed(2)}%`)
            el.style.setProperty("--bp-cy", `${(Math.min(Math.max(innerHeight/2-r.top,0),r.height)/r.height*100).toFixed(2)}%`)
          }
        })
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)

    } else if (anim === "breathe") {
      style.textContent = `
        @keyframes bp-br{0%,100%{opacity:1}50%{opacity:0.45}}
        ${sel}{position:relative!important;isolation:isolate!important}
        ${sel}::before{content:""!important;position:fixed!important;inset:0!important;z-index:-1!important;
          background-image:${grad}!important;animation:bp-br ${speed}s ease-in-out infinite!important;pointer-events:none!important}
        ${sel}>*{position:relative!important;z-index:1!important}`
    }
  }

  function init() {
    apply()
    window.addEventListener("storage", e => { if (e.key === CONFIG_KEY) apply() })
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init)
  else init()
})()
