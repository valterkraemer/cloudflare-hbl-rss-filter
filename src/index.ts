import { XMLParser, XMLBuilder } from "fast-xml-parser";

const getLinksForFeed = async (url: string) => {
  const res = await fetch(url, {
    headers: {
      accept: "application/rss+xml",
    },
  });

  const text = await res.text();

  /**
   * HTMLRewriter failed to parse "link" elements
   */
  const matches = text.matchAll(/<link>([^<]+)<\/link>/g);

  return Array.from(matches)
    .map((match) => match[1])
    .filter((value) => value.startsWith("https://www.hbl.fi/artikel"));
};

const getLinksForPage = async (url: string) => {
  const res = await fetch(url);

  const links: string[] = [];

  const rewriter = new HTMLRewriter()
    .on("*[data-article-path]", {
      element(element) {
        const value = element.getAttribute("data-article-path")!;
        links.push(value);
      },
    })
    .transform(res);

  await rewriter.text();

  return links;
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const [sportLink, kulturLinks, feed] = await Promise.all([
      getLinksForPage("https://www.hbl.fi/sport"),
      getLinksForFeed("https://www.hbl.fi/feeds/section/kultur/feed.xml"),
      fetch("https://www.hbl.fi/feeds/feed.xml", {
        headers: {
          accept: "application/rss+xml",
        },
      }).then((response) => response.text()),
    ]);

    const ignoredLinks = [...sportLink, ...kulturLinks];

    const parser = new XMLParser();
    let jObj = parser.parse(feed);

    const items = jObj.rss.channel.item;

    const filtered = items.filter((item: any) => {
      const ok = !ignoredLinks.includes(item.link);

      if (!ok) {
        console.log(`Ignore: ${item.link}`);
      }

      return ok;
    });

    jObj.rss.channel.item = filtered;

    const builder = new XMLBuilder();
    const xmlContent = builder.build(jObj);

    return new Response(xmlContent);
  },
};
