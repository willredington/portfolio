import type { Site, SocialObjects } from "./types";

export const SITE: Site = {
  website: "https://willredington.com/",
  author: "Will Redington",
  desc: "Portfolio Website",
  title: "Portfolio",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerPage: 3,
};

export const LOCALE = ["en-EN"]; // set to [] to use the environment default

export const LOGO_IMAGE = {
  enable: false,
  svg: true,
  width: 216,
  height: 46,
};

export const SOCIALS: SocialObjects = [
  {
    name: "Github",
    href: "https://github.com/willredington",
    linkTitle: ` ${SITE.title} on Github`,
    active: true,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/will-redington-04814493/",
    linkTitle: `${SITE.title} on LinkedIn`,
    active: true,
  },
  {
    name: "Mail",
    href: "mailto:will86325@gmail.com",
    linkTitle: `Send an email to ${SITE.title}`,
    active: true,
  },
];
