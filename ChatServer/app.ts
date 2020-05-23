var crypto = require("crypto");
const fs = require('fs');

import { Server } from 'ws';
import WebSocket = require('ws');
import { group } from 'console';
/*THIS IS ONLY FOR LIVE PUBLIC GROUP CHATTING*/
class User {
	private _name: string;
	private _socket: WebSocket;
	private _id: number;
	private static numUsers = 0;
	private _groups: Set<string>;
	constructor(name : string, socket: WebSocket) {
		this._name = name;
		this._socket = socket;
		this._id = ++User.numUsers;
		this._groups = new Set<string>();
	}

	get name(): string {
		return this._name;
	}

	get socket(): WebSocket {
		return this._socket;
	}

	get groups(): Set<string> {
		return this._groups;
    }

	setName(name: string) {
		this._name = name;
	}

	equals(user: User): boolean {
		return (user._id == this._id);
	}

	addGroup(groupName: string) {
		this._groups.add(groupName);
	}

	removeGroup(groupName: string) {
		this._groups.delete(groupName);
	}

}

class Group {
	private _groupName: string;
	private _users: Map<string, User>;

	constructor(groupName: string) {
		this._users = new Map<string, User>();
		this._groupName = groupName;
	}

	get groupName(): string {
		return this._groupName;
	}

	get users(): Map<string, User> {
		return this._users;
	}

	addUser(user: User): boolean {
		if (!this._users.has(user.name)) {
			user.addGroup(this._groupName);
			this._users.set(user.name,user);
			return true;
		} 
		return false;
	}

	removeUser(user: User): boolean {
		if (this._users.has(user.name) && user.equals(this._users.get(user.name))) {
			user.removeGroup(this._groupName);
			this._users.delete(user.name);
			return true;
		}
		return false;
	}

	sendMessage(message: string, from: User) {
		if (this._users.has(from.name) && from.equals(this._users.get(from.name))) {
			this._users.forEach((value: User, key: string, map: Map<string,User> )=>{
				if (key != from.name) {
					value.socket.send(JSON.stringify(
						{
							'messageType': 'message',
							'message': message,
							'from': from.name,
							'group': this._groupName
						}));
                }
			})
        }
	}

	isEmpty(): boolean {
		return (this._users.size==0);
    }
}

class Groups {
	private _availableGroups: Map<string, Group>;
	// private _archivedGroups: Map<string, Group>;

	constructor() {
		this._availableGroups = new Map<string, Group>();
		// this._archivedGroups = new Map<string, Group>();
	}

	get availableGroups(): Map<string, Group> {
		return this._availableGroups;
	}
	/*
	get archivedGroups(): Map<string, Group> {
		return this._archivedGroups;
	}*/

	addAvailableGroup(group: Group): boolean {
		if (!this._availableGroups.has(group.groupName)) {
			this._availableGroups.set(group.groupName, group);
			return true;
		}
		return false;
	}
	/*
	addArchivedGroup(group: Group): boolean {
		if (!this._archivedGroups.has(group.groupName)) {
			this._archivedGroups[group.groupName] = group;
			return true;
		}
		return false;
	}*/

	removeAvailableGroup(groupName: string): boolean {
		if (this._availableGroups.has(groupName)) {
			/*
			if (!this._archivedGroups.has(groupName))
				this._archivedGroups[groupName] = this._availableGroups[groupName];
				*/
			this._availableGroups.delete(groupName);
			return true;
		}
		return false;
	}

	addUsertoGroup(groupName: string, user: User): boolean {
		if (!this._availableGroups.has(groupName)) {
			return false;
		}
		return this._availableGroups.get(groupName).addUser(user);
    }

	sendMessageToGroup(groupName: string, message: string, from: User) {
		if (this._availableGroups.has(groupName)) {
			this.availableGroups.get(groupName).sendMessage(message, from);
        }
	}

	exitGroup(groupName: string, user: User) {
		if (this._availableGroups.has(groupName)) {
			let group: Group = this._availableGroups.get(groupName)
			group.removeUser(user);
			if (group.isEmpty())
				this._availableGroups.delete(groupName);

		}
    }
	/*
	removeArchivedGroup(groupName: string): boolean {
		if (this._archivedGroups.has(groupName)) {
			this._archivedGroups.delete(groupName);
			return true;
		}
		return false;
	}
	*/

}



let groups: Groups = new Groups();

let wsServer: Server = new Server({ port: 8080 });

wsServer.on('connection', function (client) {
	console.log('new connection');
	let user: User = new User('', client);
	let confid: string = '';

	client.on('message', function (messageData: WebSocket.Data) {
		try {
			let message = messageData.toString();
			console.log('Message: ' + message);
			const mess: Object = JSON.parse(message);
			switch (mess['messageType']) {
				case 'userName':
					{
						user.setName(mess['name']);
					}
					break;
				case 'groupName':
					{
						let groupName: string = mess['name'];
						let group: Group = new Group(groupName);
						if (groups.addAvailableGroup(group)) {

							groups.addUsertoGroup(groupName, user);

							client.send(JSON.stringify(
								{
									'messageType': 'makeGroupReply',
									'status': 'success',
									'description': ''
								}));
						}
						else {
							client.send(JSON.stringify(
								{
									'messageType': 'makeGroupReply',
									'status': 'failed',
									'description': 'group with same name already exists'
								}));
						}
					}
					break;
				case 'joinGroup':
					{
						let groupName: string = mess['groupName'];
						if (!groups.availableGroups.has(groupName))
							client.send(JSON.stringify(
								{
									'messageType': 'joinGroupReply',
									'status': 'failed',
									'description': 'group does not exists'
								}));
						else {
							groups.addUsertoGroup(groupName, user);
							client.send(JSON.stringify(
								{
									'messageType': 'joinGroupReply',
									'status': 'success',
									'description': ''
								}));
                        }
					}
					break;

				case 'message':
					{
						let groupName: string = mess['groupName'];
						let message: string = mess['message'];
						groups.sendMessageToGroup(groupName, message, user);
					}
					break;

				case "exitGroup":
					{
						let groupName: string = mess['groupName'];
						groups.exitGroup(groupName, user);
					}
					break;

			}
		}
		catch (e) {
			console.log(e);
		}
	});

	client.on('close', function (connection) {
		// close user connection
		let groupList: Array<string> = [];
		user.groups.forEach((g: string, g1: string, s: Set<string>) => {
			groupList.push(g);
		});
		groupList.forEach((g: string, g1: number, s: Array<string>) => {
			groups.exitGroup(g, user);
		});

	});
});