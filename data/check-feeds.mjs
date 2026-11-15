import { XMLParser } from "fast-xml-parser";
const urls = process.argv.slice(2);
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", cdataPropName: "__cdata", textNodeName: "#text", trimValues: true });
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15";
for (const url of urls) {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, */*" }, signal: AbortSignal.timeout(12000) });
    const xml = await res.text();
    const p = parser.parse(xml);
    const items = p?.rss?.channel?.item ?? p?.feed?.entry ?? p?.["rdf:RDF"]?.item ?? [];
    const arr = Array.isArray(items) ? items : [items];
    const t = (x) => (typeof x === "string" ? x : x?.__cdata ?? x?.["#text"] ?? x?.["@_href"] ?? "");
    console.log(url.replace(/^https?:\/\//,"").slice(0,42), res.status, "items", arr.length, "|", String(t(arr[0]?.title)).slice(0,50), "|", t(arr[0]?.pubDate ?? arr[0]?.["dc:date"] ?? arr[0]?.published ?? arr[0]?.updated).slice(0,20));
  } catch (e) {
    console.log(url.slice(0,45), "ERR", String(e.message).slice(0,40));
  }
}
