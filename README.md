# dungeon-revealer

[![Build Status](https://img.shields.io/github/workflow/status/dungeon-revealer/dungeon-revealer/Node.js%20CI)](https://github.com/dungeon-revealer/dungeon-revealer/actions)
[![Downloads](https://img.shields.io/github/downloads/dungeon-revealer/dungeon-revealer/total.svg?logo=github)](https://github.com/dungeon-revealer/dungeon-revealer/releases)
[![Release](https://img.shields.io/github/v/release/dungeon-revealer/dungeon-revealer?logo=github&color=orange)](https://github.com/dungeon-revealer/dungeon-revealer/releases/latest)
[![Docker](https://img.shields.io/static/v1?label=docker&message=v1.17.1&color=blue&logo=Docker)](https://github.com/dungeon-revealer/dungeon-revealer/pkgs/container/dungeon-revealer/versions)
[![Discord](https://img.shields.io/discord/709687178422386708)](https://discord.gg/dS5khqk)

Dungeon Revealer is an open source self-hosted app for playing pen and paper such as Dungeon and Dragons or Cyberpunk or other tabletop games together.

The main features include revealing game maps to players, moving around tokens on a map, a dice roll chat and sharing notes and images.

Dungeon Revealer supports both desktop clients and mobile clients, such as tablets or phones. It can be used for in person gaming on a local network or for online gaming via the internet.

Join the [discord server](https://discord.gg/dS5khqk).
Check out the [wiki](https://github.com/dungeon-revealer/dungeon-revealer/wiki) for a detailed walkthrough!

## What the DM Sees

![alt text](https://user-images.githubusercontent.com/14338007/83942937-68312280-a7f8-11ea-9a63-8307f1c12d50.png "DM's View")

You can protect the DM area by setting a password.

## What the players see

![alt text](https://user-images.githubusercontent.com/14338007/83942940-6e270380-a7f8-11ea-9eb5-ec440ea57c83.png "Player's view")

## Getting Started

### Getting the app

The easiest way to use dungeon-revealer is to download the app from the [releases](https://github.com/dungeon-revealer/dungeon-revealer/releases) page here on github. There is also a [docker image](https://ghcr.io/dungeon-revealer/dungeon-revealer) that is kept up to date with the releases in this repository.

#### Prebuilt app

**Download the app for your system from the [releases page](https://github.com/dungeon-revealer/dungeon-revealer/releases).**
We provide builds for Windows, Linux, and OSX.

Running from the command prompt will present connection information and some debugging.
Optionally, you may set a password for the dungeon master and/or players by setting the environmental variables `DM_PASSWORD` and `PC_PASSWORD` when starting the app. e.g. for linux `PC_PASSWORD='password1' DM_PASSWORD='password2' ./dungeon-revealer-linux`
Leaving a variable undefined will disable authentication and allow public access for that section of the map.

##### Linux

Open the zip file and extract the files to your preferred location.

Then you can run the app directly in the terminal.

```
./dungeon-revealer-linux
```

Then go to `localhost:3000` in your browser and point your players to `<YOUR_IPADDRESS>:3000`.
This information is also present in the terminal window.

There is also a community maintained [AUR package](https://aur.archlinux.org/packages/dungeon-revealer-bin/).

##### OSX

Open the zip file and extract the files to your preferred location.

Double click the app. A terminal will open with useful information.
Then go to `localhost:3000` in your browser and point your players to `<YOUR_IPADDRESS>:3000`.
This information is also present in the terminal window.

##### Windows

Double click the app. A command prompt will open with useful information.
Then go to `localhost:3000` in your browser and point your players to `<YOUR_IPADDRESS>:3000`.
This information is also present in the command prompt window.

##### Docker

We provide docker images for x64 and arm architectures.
An up to date version of docker is required to make sure the correct image architecture is pulled for your host machine.
To create an instance, run the following:

```
docker pull ghcr.io/dungeon-revealer/dungeon-revealer:v1.17.1
docker run -e DM_PASSWORD=<password> -e PC_PASSWORD=<password> -p <PORT>:3000 -v <DATA_DIR>:/usr/src/app/data -d ghcr.io/dungeon-revealer/dungeon-revealer:latest
```

- Replace `<password>` with your chosen passwords.
- Replace `<PORT>` with your preferred port.
- `<DATA_DIR>` is the directory on the host filesystem in which you want to store the maps and settings. `<DATA_DIR>` **must be an absolute path.** One way to achieve this in linux is to navigate to the directory you want in the terminal and then use `$PWD/data` as `<DATA_DIR>`.

In your browser, go to `<YOUR_IPADDRESS>:<PORT>/dm`. If your players are on the local network, have them go to `<YOUR_IPADDRESS>:<PORT>`.

##### Heroku

Heroku is a platform supporting one-click deployments and includes a free usage tier. Sign up for a free account then click the button below. Give your app a unique name, set any required passwords, and click `Deploy App` to start the build process.

> **Note:** the Heroku deployment will not preserve user data over time (see [#405](https://github.com/dungeon-revealer/dungeon-revealer/issues/405)).

[![button](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/dungeon-revealer/dungeon-revealer/tree/v1.17.1)

### Using the app

The app is separated into two sections. One for the dungeon master and one for the players. Check out the [wiki](https://github.com/dungeon-revealer/dungeon-revealer/wiki) for a detailed walkthrough!

#### Dungeon Master

To use dungeon-revealer, the game master and the players must be on the same local network (usually a wifi network). The game master will start the server (see Installation), navigate to the server's URL in a web browser, click on the Dungeon Master link, and then enter a password if it is set. At this point, they will be prompted to upload an image file of the map to share with the other players. The other players will navigate to the server using their own browsers (laptop, tablet, or phone) and will remain at the home page. The connection information is displayed in command prompt for convenience.

To clear areas of the map, click and draw on the map. You can switch the brush mode by clicking the "Reveal" or "Shroud" button. Alternatively, you can select an area to clear or shroud by clicking the "Select Area" button. Whenever the game master clears some of the fog of war from the map and it is ready to share with the players, they will click "Send" and the revealed areas of the map will appear in the players' browsers. What appears as a shadow to the DM will appear as pure blackness to players, thus only revealing the cleared sections of the map to them. The "Mark" button will display a circle for a period of time to indicate a point of interest.

To switch to a different map, click "Map Library", and then select one of the maps you have already uploaded and click "Load". The "LIVE" indicator in the lower right indicates if the map currently on the dungeon master page is being presented on the player page. the "Stop Sharing" button will blank the player page in preparation for a new map to be loaded.

You can add token with the "Token" tool. Click anywhere on the map to place it. The token can be changed by opening the context menu trough right-clicking on a single token. You can alter it's label, color and size.

##### Shortcuts

| Key            | Functionality                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------- |
| `1`            | select move tool.                                                                             |
| `2`            | select area tool.                                                                             |
| `3`            | select brush tool.                                                                            |
| `4`            | select mark tool.                                                                             |
| `5`            | select token tool.                                                                            |
| `Shift`        | toggle between hide/reveal.                                                                   |
| `CMD/Ctrl + S` | push map to players.                                                                          |
| Hold `Alt`     | use move tool while `Alt` key is pressed and return to previous mode after `Alt` is released. |

#### Players

Navigate to the server using a web browser and wait at the home page. (The connection information is displayed in command prompt for convenience.) When the dungeon master is ready, they will push a map to your webpage. You will see either a black screen or a partially covered image. You can zoom in/out and pan the map. On a long click you will place a "point of interest" on the map that will show as a red circle.

## Contributing

See the [CONTRIBUTING.md](CONTRIBUTING.md).



DM SIDE:

Toolbar: On the left side of the screen is the toolbar which gives access to tools for manipulating the map.
Move: Allows for clicking and dragging to move the map around
Brush: Depending on if reveal or shroud is activated, allows you to draw to add or remove fog of war (you can edit size and shape of brush).
Area: Depending on if reveal or shroud is activated, allows you to click and drag an area to add or remove fog of war.
Mark: Allows you to ping where you click to point something out to the players.
Token: Allows you to edit the properties of a token (size, color, label, counter)
Reveal / Shroud: When reveal is selected, other buttons will remove fog, when shroud is selected, other buttons will add fog.
Shroud All / Clear All: They shroud the map completely in fog or remove all fog from the map respectively.

Tokens: Tokens placeable entities on the map with editable properties.
 Position: The location of the token on the map, can be changed with specific X/Y coordinates or freely moved.
Size: The size of the token.
Rotation: Rotates the token.
Position locked: Makes the token not freely movable, can still change X/Y coordinates.
Title: Displays the name of the token.
Color: Changes the color of the token.
Visible to players: If on, players can see the token, if off, players can’t see the token.
Moveable by players: If on, players can move the token, if off, players cannot move the token.
Reference: Allows you to link a  DM note to the token.
Image: Allows you to add an image to the token.

Grid: This button allows a grid to be added on top of the map, it can be adjusted to fit the desired size.

Map Library: This opens up the map library which contains all maps the DM has.
Map List: Displays all the maps the DM has, you can select a map here and a preview of it will show on the right.
Create New Map: This creates a blank map, it will ask for the upload of an image (png, jpg, jpeg, svg), and a name for the map.
Create New Scenario: This creates a “full” map with tokens and fog already in place, it will ask for the upload of 4 files, (settings.json, map image, fog.live.png, fog.progress.png) and a name for the map.
Default Scenario Folder: Contains a list of default scenarios, prepared maps with tokens and fog.
Map List: A list of all default maps
Add New Default Scenario: A button to upload default scenarios, will ask for the upload of 4 files (settings.json, map image, fog.live.png, fog.progress.png).
Delete: Delete the selected scenario
Load Scenario: Loads the default scenario into the map library
Filter: A way to search the map list for specific maps.
Delete: Deletes the current selected map.
Load Map: After a map is selected from the list, this loads the map as the active map.

View & Download Session: Allows you to view all saved sessions and possibly retrieve zoom data, view the data, and download it.
View:  
Iterations: Shows the current state of the map after each iteration.
Movement Graph: Shows the path all tokens took throughout the session.
Herd Graph: A graph that displays the distance relationship between all tokens, you can select which tokens to display using the left sidebar. Also displays the center point of selected tokens, this can be toggled. 
Whiteboard Iterations: Snapshots of the whiteboard that were collected (1 minute intervals).
Zoom: After adding all required information, and selecting the desired recording and transcript, it will be added to the session folder and able to be downloaded. There is also a button that takes the DM to their zoom page to simplify the process.
Download: Will download the session and all its data to your computer.

Save Session: Will save the session under the selected name and allows you to view it in the “View & Download Session” button.

Drawing: This opens up the whiteboard so you can view what the players are drawing.
Share button: Clicking this will share it with all participants, allowing live collaboration.

Notes: DM notes that all players can see. 

Stop Sharing: Stops showing the map to the players.

Not live/ Live: Shows whether or not the players can see the map.

Send: Sends the current state of the map to the players, if fog is changed for example, you must hit send to update the players view.

Start Recording: Begins the collection of data on the map, when a player moves a token or a change takes place, it will save an iteration. It must be live and recording for it to actually record.

Clear Session: Clears the current recording, after hitting this button, you can start recording fresh again.


PLAYER SIDE:

Center Map: This centers the map for the player.

Zoom In/ Zoom Out: Zooms into the map or out of the map respectively.

Measure Distance: When on, clicking and holding 2 locations will display their distance on the top of the screen, if a grid is on, distance is calculated based off of that, if grid is off its based on pixels.

Player Notes: Personal notes for the player, allows them to keep track of whatever they need, this will be saved and available after data is downloaded.

Dm Notes: Allows players to view the DM notes.

Drawing: Opens up the whiteboard, if a player hits share, it will also share to everyone.

Tokens: Players can move tokens if the DM has allowed them to, same with visibility.

Fog of war: Players cannot see parts of the map covered in fog of war.


CHAT AND OTHERS:

Right-side panel: At the top right, clicking the chat bubble icon, will open or close the right-side panel.
Chat: Allows for players and DM to communicate through text.
Users: Shows all the players currently connected.
Settings: Allows for users to change their display name and toggle sound.



