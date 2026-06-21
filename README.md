<img align="center" src=".github/assets/banner.png" alt="GridDown Banner">
<hr>
<div align="center">
  <img alt="GitHub deployments" src="https://img.shields.io/github/deployments/6xtvo/GridDown/Production%20?style=for-the-badge&label=Deployment">
  <img alt="GitHub top language" src="https://img.shields.io/github/languages/top/6xtvo/GridDown?style=for-the-badge">
  <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/6xtvo/GridDown?style=for-the-badge&color=red">
  <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/6xtvo/GridDown?style=for-the-badge&color=yellow">
</div>

## Overview
GridDown is the 🥇 1st place submission for the [GDGC](https://gdg.community.dev/gdg-on-campus-the-university-of-auckland-auckland-new-zealand/) (Google Developer Groups on Campus) 2026 Hackathon by our team, Team Buckley.

## The Problem
A solar flare has impacted earth. Internet and power is still up, but server data has been corrupted, rendering them unreliable and useless.

Food, medicine, shelter, skills - they exist but aren't where they're needed. How do you match supply to demand across a city with no central
coordinator? Our team chose to focus on the issue of **Resources without coordination**.

You can view read more of the hackathon theme and brief [here](.github/assets/brief.pdf).

## The Solution
When the grid goes down, that's where GridDown steps in. We built a de-centralised emergency co-ordination system application to remove the need for reliance on corrupted servers.

GridDown allows anyone to broadcast requests for help and set the urgency of these requests, offers to help, or announcements, and set the locations for these broadcasts. Users can set their location upon onboarding, as well as their name, age and skillset, and the closest broadcasts and their urgency will be prioritised and displayed on a live board. On the right, users can view the shortest path and distance from the locations of these broadcasts on a live, interactive map.

To implement a trust-building feature, GridDown allows users to upvote or downvote broadcasts, and a chatting feature also enables users to communicate with broadcast offers.

## The Approach
Initially, our project adopted a client-server model with Next.js, tRPC, Tailwind, NextAuth, Prisma and PostgreSQL.

With the transition to a serverless P2P implementation with WebRTC, NextAuth, Prisma and PostgreSQL was no longer needed. tRPC remained to serve as a signalling server for SDP and ICE candidate transmission.

You can read more about our implementation in [architecture.md](docs/architecture.md) and how WebRTC works with our codebase in [webrtc.md](docs/webrtc.md). 

## Team Buckley

| <img src="https://avatars.githubusercontent.com/u/72182515?v=4" width="200"> | <img src="https://avatars.githubusercontent.com/u/78674065?v=4" width="200"> | <img src="https://avatars.githubusercontent.com/u/264532820?v=4" width="200"> | <img src="https://avatars.githubusercontent.com/u/99226158?v=4" width="200"> | <img src="https://avatars.githubusercontent.com/u/102767502?v=4" width="200"> |
|-|-|-|-|-|
| [Benjamin Kee](https://github.com/6xtvo) | [Tommy Duan](https://github.com/tommy-duan-github) | [Wilson Mao](https://github.com/FuzeShieldMeta) | [Gladwyn Chua](https://github.com/GladwynChua) | [Gloria Chan](https://github.com/Aname326) |
| Team Leader<br>Developer | Developer | Developer | Developer | Developer |

## Contributing
This project is closed to contributions. For team members, the contributing guide is under [CONTRIBUTING.md](.github/CONTRIBUTING.md).

## Links
* [Website](https://griddown.vercel.app/)
* [Presentation](https://buckley-presents.vercel.app/)
* [Presentation Repository](https://github.com/6xtvo/griddown-presentation)
* [More on GDGC](https://gdg.community.dev/gdg-on-campus-the-university-of-auckland-auckland-new-zealand/)

## License
This project is licensed under the [GNU General Public License v3.0](.github/LICENSE.md).
