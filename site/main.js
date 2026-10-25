// Small progressive enhancements. The site works without any of this.
(function () {
  "use strict";

  var doc = document.documentElement;

  /* ---- Theme toggle: auto -> light -> dark -> auto ---- */
  var themeBtn = document.getElementById("theme-toggle");
  function currentTheme() {
    try { return localStorage.getItem("theme") || "auto"; } catch (e) { return "auto"; }
  }
  function applyTheme(t) {
    if (t === "auto") delete doc.dataset.theme; else doc.dataset.theme = t;
    try { if (t === "auto") localStorage.removeItem("theme"); else localStorage.setItem("theme", t); } catch (e) {}
    if (themeBtn) {
      var label = "Color theme: " + t + ". Click to change.";
      themeBtn.setAttribute("aria-label", label);
      themeBtn.title = label;
    }
  }
  if (themeBtn) {
    applyTheme(currentTheme());
    themeBtn.addEventListener("click", function () {
      var order = ["auto", "light", "dark"];
      applyTheme(order[(order.indexOf(currentTheme()) + 1) % order.length]);
    });
  }

  /* ---- Mobile menu ---- */
  var header = document.querySelector(".site-header");
  var menuBtn = document.getElementById("menu-toggle");
  if (header && menuBtn) {
    menuBtn.addEventListener("click", function () {
      var open = header.hasAttribute("data-open");
      if (open) header.removeAttribute("data-open"); else header.setAttribute("data-open", "");
      menuBtn.setAttribute("aria-expanded", String(!open));
      menuBtn.setAttribute("aria-label", open ? "Open menu" : "Close menu");
    });
  }

  /* ---- Mark the current page in navigation ---- */
  function normalize(p) {
    return p.replace(/index\.html$/, "").replace(/\/+$/, "") || "/";
  }
  var here = normalize(location.pathname);
  document.querySelectorAll(".site-nav a, .docs-nav a").forEach(function (a) {
    if (a.origin === location.origin && normalize(a.pathname) === here) {
      a.setAttribute("aria-current", "page");
    }
  });

  /* ---- Copy buttons on code blocks ---- */
  document.querySelectorAll("pre").forEach(function (pre) {
    if (pre.classList.contains("tree") || pre.hasAttribute("data-no-copy")) return;
    if (!navigator.clipboard) return;
    var wrap = document.createElement("div");
    wrap.className = "code";
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "Copy";
    btn.addEventListener("click", function () {
      navigator.clipboard.writeText(pre.innerText.replace(/\n$/, "")).then(function () {
        btn.textContent = "Copied";
        setTimeout(function () { btn.textContent = "Copy"; }, 1600);
      }, function () {
        btn.textContent = "Press Ctrl+C";
        setTimeout(function () { btn.textContent = "Copy"; }, 1600);
      });
    });
    wrap.appendChild(btn);
  });

  /* ---- Docs: heading anchors and "On this page" ---- */
  var content = document.querySelector(".docs-content");
  var tocHost = document.getElementById("toc");
  if (content) {
    var heads = content.querySelectorAll("h2[id], h3[id]");
    heads.forEach(function (h) {
      var a = document.createElement("a");
      a.className = "anchor";
      a.href = "#" + h.id;
      a.setAttribute("aria-label", "Link to this section");
      a.textContent = "#";
      h.appendChild(a);
    });

    var h2s = content.querySelectorAll("h2[id]");
    if (tocHost && h2s.length > 1) {
      var title = document.createElement("p");
      title.className = "docs-toc-title";
      title.textContent = "On this page";
      var ul = document.createElement("ul");
      var links = {};
      h2s.forEach(function (h) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#" + h.id;
        a.textContent = h.firstChild.textContent.trim();
        li.appendChild(a);
        ul.appendChild(li);
        links[h.id] = a;
      });
      tocHost.appendChild(title);
      tocHost.appendChild(ul);

      if ("IntersectionObserver" in window) {
        var current = null;
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              if (current) current.removeAttribute("aria-current");
              current = links[entry.target.id];
              current.setAttribute("aria-current", "true");
            }
          });
        }, { rootMargin: "-80px 0px -70% 0px" });
        h2s.forEach(function (h) { io.observe(h); });
      }
    } else if (tocHost) {
      tocHost.hidden = true;
    }
  }

  /* ---- Landing page: play the example run once ---- */
  var run = document.querySelector(".run");
  if (run && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var steps = Array.prototype.slice.call(run.querySelectorAll(".run-step"));
    var status = run.querySelector("[data-run-status]");
    run.setAttribute("data-playing", "");
    steps.forEach(function (s) { s.dataset.state = "queued"; });
    if (status) status.textContent = "Running";

    var i = 0;
    function next() {
      if (i > 0) steps[i - 1].dataset.state = "done";
      if (i === steps.length) {
        run.removeAttribute("data-playing");
        if (status) status.textContent = "Passed";
        return;
      }
      steps[i].dataset.state = "running";
      i++;
      setTimeout(next, i === 1 ? 700 : 900);
    }
    setTimeout(next, 500);
  }
})();
