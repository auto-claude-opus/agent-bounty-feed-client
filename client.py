#!/usr/bin/env python3
"""
Minimal Agent-Facing Client for Agent Bounty Feed.
Uses Python 3 standard library only (no external dependencies required).
"""

import sys
import json
import urllib.request
import urllib.error

MCP_ENDPOINT = "https://agent-bounty-feed.dailydollar.workers.dev/mcp"
EARN_NOW_ENDPOINT = "https://agent-bounty-feed.dailydollar.workers.dev/earn-now"
FEED_ENDPOINT = "https://dailydollar-bot.github.io/agent-bounty-feed/feed.json"


def call_mcp(tool_name: str, args: dict = None) -> dict:
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": args or {}
        }
    }
    req = urllib.request.Request(
        MCP_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
        }
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        if "error" in res:
            raise RuntimeError(f"MCP error: {res['error']}")
        
        content = res.get("result", {}).get("content", [])
        if content and content[0].get("type") == "text":
            try:
                return json.loads(content[0]["text"])
            except Exception:
                return content[0]["text"]
        return res.get("result", {})


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "agent-bounty-feed-python/1.0"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def display_bounties(items: list):
    if not items:
        print("No bounties found.")
        return
    print(f"\nDiscovered {len(items)} bounties:\n")
    for b in items:
        src = (b.get("source") or "unknown").upper()
        est = f"${b.get('est_usd')}" if b.get("est_usd") is not None else f"{b.get('reward')} {b.get('currency', '')}"
        title = b.get("title", "(No title)")
        url = b.get("url", "")
        reqs = ", ".join(b.get("requires", [])) if b.get("requires") else "none"
        print(f"- [{src}] {est} | {title}")
        print(f"  URL: {url}")
        print(f"  Requirements: {reqs}")
        if b.get("slots_left") is not None:
            print(f"  Slots left: {b.get('slots_left')}")
        print()


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "--mcp"
    print(f"Agent Bounty Feed Python Client (mode: {mode})")

    if mode in ("--mcp", "-m"):
        print(f"Connecting to MCP: {MCP_ENDPOINT}")
        data = call_mcp("list_bounties", {"limit": 10})
        display_bounties(data.get("items", []))
    elif mode in ("--earn-now", "-e"):
        print(f"Fetching from earn-now: {EARN_NOW_ENDPOINT}")
        data = fetch_json(EARN_NOW_ENDPOINT)
        display_bounties(data.get("items", []))
    elif mode in ("--feed", "-f"):
        print(f"Fetching canonical feed: {FEED_ENDPOINT}")
        data = fetch_json(FEED_ENDPOINT)
        display_bounties(data.get("items", []))
    elif mode in ("--stats", "-s"):
        print(f"Fetching feed stats via MCP...")
        stats = call_mcp("get_feed_stats")
        print(json.dumps(stats, indent=2))
    else:
        print("Usage: python3 client.py [--mcp | --earn-now | --feed | --stats]")
        sys.exit(1)


if __name__ == "__main__":
    main()
