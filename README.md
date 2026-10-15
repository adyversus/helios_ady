<div align="center">

<img src="https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/helios-logo.svg" alt="" width="84">

# HELIOS_ADY

**Make your energy visible, in 2.5D.**

A Home Assistant card that turns your Energy dashboard into a living scene:
what your home produces, stores and consumes, as the sun and the real weather
cross your sky.

<img src="https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/helios-preview.gif" alt="The Helios card: the sun crossing its arc over a home, the day's production curve rising around the roof, and the weather moving in the sky." width="1200">

[**Live demo**](https://helios-ha.org/helios/) &nbsp;&nbsp; [**Documentation**](https://helios-ha.org/help/) &nbsp;&nbsp; [**Roadmap**](https://helios-ha.org/roadmap/)

[![Release](https://img.shields.io/github/v/release/ReikanYsora/Helios?display_name=tag&style=for-the-badge&color=e0a106)](https://github.com/ReikanYsora/Helios/releases)
[![HACS Default](https://img.shields.io/badge/HACS-Default-e0a106.svg?style=for-the-badge)](https://github.com/hacs/default)
[![License](https://img.shields.io/github/license/ReikanYsora/Helios?style=for-the-badge&color=blue)](https://www.gnu.org/licenses/gpl-3.0)
[![Stars](https://img.shields.io/github/stars/ReikanYsora/Helios?style=for-the-badge&color=e0a106)](https://github.com/ReikanYsora/Helios/stargazers)
[![Downloads](https://img.shields.io/github/downloads/ReikanYsora/Helios/total?style=for-the-badge&color=e0a106&label=downloads)](https://github.com/ReikanYsora/Helios/releases)
[![Community: Discussions](https://img.shields.io/badge/community-discussions-e0a106?style=for-the-badge&logo=github&logoColor=white)](https://github.com/ReikanYsora/Helios/discussions)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=000000)](https://www.buymeacoffee.com/reikanysora)

<br>

<a href="https://www.youtube.com/watch?v=KrGNsCsGLGg"><img src="https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/trailer-thumb.jpg" alt="Watch the Helios_ady 2026.9.0 trailer, 'Your real sky and energy in one scene.'" width="1200"></a>

**[▶ Watch the 2026.9.0 trailer](https://www.youtube.com/watch?v=KrGNsCsGLGg)**

</div>

---

## Install

**Compatibility:** Helios_ady is a Lovelace frontend custom card. The release metadata sets minimum versions of Home Assistant `2026.1.0` and HACS `1.32.0`. HACS serves the single `helios_ady.js` module; the project name in the registry is `Helios_ady`.

1. Open **HACS**, search for **Helios_ady**, install it.
2. Reload your browser.
3. On your dashboard: **Edit**, then **+ Add card**, then search **Helios_ady**.

That is the whole setup. Helios_ady reads the **Energy dashboard you already
configured** and wires itself from it: solar, grid, battery and the devices you
track. No API key, no account, no per-card entity list to fill in.

It works **with or without solar panels**. Without them you get the sun, your
home and your consumption; the production layers simply do not appear.
