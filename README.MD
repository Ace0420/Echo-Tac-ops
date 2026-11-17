# Echo: Tactical Ops

A voice-controlled tactical game for blind and visually impaired players.

## About
Echo: Tactical Ops is played entirely through voice commands and audio feedback. You are a special operations soldier working through a five-mission campaign. Finishing missions earns credits, which you spend in the armory on new weapons and upgrades.

Your progress is saved on your own device. Nothing is sent anywhere.

## How to Play
1. Open the game in Chrome or Edge (best voice recognition support)
2. Allow microphone access when prompted
3. Tap anywhere on the screen, wait for the chirp, and speak
4. A second chirp tells you the microphone has closed

Say **repeat** at any time to hear the last thing again, and **help** to hear what you can say.

## The Missions
1. Compound Breach
2. Night Convoy
3. Hostage Rescue (no grenades: the hostages are inside)
4. Harbor Raid
5. Mountain Stronghold

Each mission unlocks the next. Finished missions can be replayed for half pay.

Every mission is played the same way, so there is nothing new to learn each time:

1. **Approach** - say "stealth" or "breach"
2. **Entry** - say "push" or "tactical"
3. **Combat** - fire, cover, grenade, medkit, reload, suppress

## Voice Commands

### At Base
- "deploy" - Start your next mission
- "missions" - Hear the mission list, then "mission" and a number
- "armory" - Then "weapons" or "upgrades"
- "buy" and a name - Buy a weapon or upgrade
- "equip" and a name - Carry a weapon you own
- "loadout" - Hear what you carry
- "reset career" - Start over from nothing (asks you to confirm)

### On a Mission
- "stealth" or "breach" - How you approach
- "engage" or "retreat" - If the stealth approach goes wrong
- "push" or "tactical" - How you enter
- "status" - Health, ammo and supplies
- "abort mission" - Go back to base

### In Combat
- "fire" - Shoot
- "cover" - Get behind cover: harder to hit, steadier aim
- "grenade" - Can take down two at once
- "medkit" - Restore health
- "reload" - Fresh magazine
- "suppress" - Pin the enemy down and get a free move

### Overwatch
Overwatch is your handler on the radio, and has opinions. Say "overwatch off" to silence the remarks and "overwatch on" to bring them back.

### AI Narrator (optional)
Say "narrator on" and a small language model on your own device writes a fresh line about each mission site, in Overwatch's voice. It needs a one-time download of about 270 MB. The download and the on/off choice are shared with the other Echo games, so if you already turned the narrator on in Echo Dungeon, it is already here. Say "narrator off" to stop it and "narrator status" to check on it.

## Weapons
- Carbine - balanced, and free
- Submachine gun - quiet, good for stealth
- Shotgun - hits hard in the open
- Marksman rifle - deadly from cover
- Machine gun - 100 rounds, strong suppressing fire

## Upgrades
Armor plates, extended magazines, grenade pouch, trauma kit, suppressor, optics, conditioning.

## Adding Your Own
Weapons, upgrades, missions and Overwatch's remarks are plain lists near the top of `index.html` (Parts 2 and 3). Copy a block, change the words and numbers, and the game picks it up.

## Requirements
- Modern web browser (Chrome/Edge recommended)
- Microphone access
- A secure (https) web address
