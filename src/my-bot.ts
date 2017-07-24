import * as firebase from 'firebase';
import { Position } from './interfaces/position';
import { ShipPlace } from './interfaces/shipPlace';
import { Shot } from './interfaces/shot';

export class MyBot {

    private config = {
        apiKey: "AIzaSyD6ACQdu7gK-BgtJs-3Hu1Lkczk8fp0Abo",
        authDomain: "brokenbot-battleships.firebaseapp.com",
        databaseURL: "https://brokenbot-battleships.firebaseio.com",
        storageBucket: "brokenbot-battleships.appspot.com"
    };
    private matchId: number;

    constructor() {
        firebase.initializeApp(this.config);
        this.authenticate();        
    }
    
    public getShipPositions(): ShipPlace[] {
        let exists: boolean = false;
        let counter: number = 0;        
        do {
            this.matchId = Math.floor(Math.random() * 10000) + 1;
            firebase.database().ref('matches/' + this.matchId.toString()).once('value').then((snapshot) => {
                if (snapshot.val()) {
                    exists = true;
                } else {
                    exists = false;
                }
            });
            counter++;
            if (counter > 10000) {
                throw new Error("Infinite loop when constructing bot");
            }
        } while (exists)
        firebase.database().ref('matches/' + this.matchId.toString()).set({
            started: true,
            hitmode: false,
            sizes: {
                patrol: true,
                submarine: true,
                destroyer: true,
                battleship: true,
                carrier: true
            },
            hitmap: []
        });
        let shipPlaces: ShipPlace[] = [];
        let done: boolean = false;
        counter = 0;
        do {
            shipPlaces = [];
            counter++;
            shipPlaces[0] = this.getAirCarrierPlace(shipPlaces);
            if (shipPlaces[0].StartingSquare.Column === -1) {
                continue;
            }
            shipPlaces[1] = this.getBattleshipPlace(shipPlaces);
            if (shipPlaces[1].StartingSquare.Column === -1) {
                continue;
            }
            shipPlaces[2] = this.getDestroyerPlace(shipPlaces);
            if (shipPlaces[2].StartingSquare.Column === -1) {
                continue;
            }
            shipPlaces[3] = this.getSubmarinePlace(shipPlaces);
            if (shipPlaces[3].StartingSquare.Column === -1) {
                continue;
            }
            shipPlaces[4] = this.getPatrolPlace(shipPlaces);
            if (shipPlaces[4].StartingSquare.Column === -1) {
                continue;
            }
            done = true;
        } while ((!done) && (counter < 10000))
        if (counter === 10000) {
            throw new Error("Infinite loop generating ship positions");
        }
        return shipPlaces;
    }

    public selectTarget(gamestate): Promise<Position> {
        return new Promise((resolve, reject) => {
            if (gamestate.MyShots.length === 0) {
                resolve(this.randomShot(gamestate));
            }
            const previousShot: Shot = gamestate.MyShots && gamestate.MyShots[gamestate.MyShots.length-1];
            let target: Position = this.getNextTarget(previousShot.Position);
            let result: boolean = previousShot.WasHit;
            if (result) {
                let updates: any = {};
                updates.hitmode = true;
                firebase.database().ref('matches/' + this.matchId.toString()).update(updates);
            }
            firebase.database().ref('matches/' + this.matchId.toString()).once('value').then((snapshot) => {
                let snapCopy = snapshot.val();
                if (result) {
                    snapCopy.hitmode = true;
                    if (snapCopy.hitmap) {
                        snapCopy.hitmap.push(previousShot.Position);
                    } else {
                        snapCopy.hitmap = [previousShot.Position];
                    }
                }
                firebase.database().ref('matches/' + this.matchId.toString()).set(snapCopy);
                if (snapCopy.hitmode) {
                    target = this.track(gamestate,snapCopy);
                } else {
                    target = this.randomShot(gamestate);
                }
                return resolve(target);
            })
            .catch((err) => {console.log(err)});
        })
        
        
    }

    private getNextTarget(position: Position): Position {
        var column = this.getNextColumn(position.Column);
        var row = column === 1 ? this.getNextRow(position.Row) : position.Row;
        return { Row: row, Column: column }
    }

    private getNextRow(row): string {
        var newRow = row.charCodeAt(0) + 1;
        if(newRow > 'J'.charCodeAt(0)) {
            return 'A';
        }
        return String.fromCharCode(newRow);
    }

    private getNextColumn(column): number {
        return column % 10 + 1;
    }

    private authenticate(): void {
        firebase.auth().signInWithEmailAndPassword(
            "david.may-miller@softwire.com",
            "securePassword3"
        );
    }

    private getAirCarrierPlace(shipPlaces: ShipPlace[]): ShipPlace {
        let counter:number = 0;
        let place: ShipPlace = { StartingSquare: { Row: "A", Column: 1 }, EndingSquare : { Row: "A", Column: 5 } };
        let collision: boolean = false;
        do {
            let places: ShipPlace[] = shipPlaces.slice(0);
            collision = false;
            const row: string = String.fromCharCode(Math.floor(Math.random() * 10) + 65);
            const column: number = Math.floor(Math.random() * 10) + 1;
            if ((row > 'F') && (column > 6)) {
                continue;
            }
            if (((Math.random() < 0.5) && (row <= 'F')) || (column > 6)) {
                place = { StartingSquare: { Row: row, Column: column }, EndingSquare: { Row: String.fromCharCode(row.charCodeAt(0) + 4), Column: column } };
            } else {
                place = { StartingSquare: { Row: row, Column: column }, EndingSquare: { Row: row, Column: (column + 4) } };
            }
            places.push(place);
            if (this.detectCollision(places)) {
                collision = true;
                counter++;
            } else {
                console.log(JSON.stringify(places))
            }
        } while((counter < 500) && (collision))
        if (counter === 500) {
            return { StartingSquare: { Row: "A", Column: -1 }, EndingSquare : { Row: "A", Column: 5 } };
        }
        return place;
    }

    private getBattleshipPlace(shipPlaces: ShipPlace[]): ShipPlace {
        let counter:number = 0;
        let place: ShipPlace = { StartingSquare: { Row: "C", Column: 1 }, EndingSquare : { Row: "C", Column: 4 } };
        let collision: boolean = false;
        do {
            let places: ShipPlace[] = shipPlaces.slice(0);
            collision = false;
            const row: string = String.fromCharCode(Math.floor(Math.random() * 10) + 65);
            const column: number = Math.floor(Math.random() * 10) + 1;
            if ((row > 'G') && (column > 7)) {
                continue;
            }
            if (((Math.random() < 0.5) && (row <= 'G')) || (column > 7)) {
                place = { StartingSquare: { Row: row, Column: column }, EndingSquare: { Row: String.fromCharCode(row.charCodeAt(0) + 3), Column: column } };
            } else {
                place = { StartingSquare: { Row: row, Column: column }, EndingSquare: { Row: row, Column: (column + 3) } };
            }
            places.push(place);
            if (this.detectCollision(places)) {
                collision = true;
                counter++;
            } else {
                console.log(JSON.stringify(places))
            }
        } while((counter < 500) && (collision))
        if (counter === 500) {
            return { StartingSquare: { Row: "A", Column: -1 }, EndingSquare : { Row: "A", Column: 5 } };
        }
        return place;
    }

    private getDestroyerPlace(shipPlaces: ShipPlace[]): ShipPlace {
        let counter:number = 0;
        let place: ShipPlace = { StartingSquare: { Row: "E", Column: 1 }, EndingSquare : { Row: "E", Column: 3 } };
        let collision: boolean = false;
        do {
            let places: ShipPlace[] = shipPlaces.slice(0);
            collision = false;
            const row: string = String.fromCharCode(Math.floor(Math.random() * 10) + 65);
            const column: number = Math.floor(Math.random() * 10) + 1;
            if ((row > 'H') && (column > 8)) {
                continue;
            }
            if (((Math.random() < 0.5) && (row <= 'H')) || (column > 8)) {
                place = { StartingSquare: { Row: row, Column: column }, EndingSquare: { Row: String.fromCharCode(row.charCodeAt(0) + 2), Column: column } };
            } else {
                place = { StartingSquare: { Row: row, Column: column }, EndingSquare: { Row: row, Column: (column + 2) } };
            }
            places.push(place);
            if (this.detectCollision(places)) {
                collision = true;
                counter++;
            } else {
                console.log(JSON.stringify(places))
            }
        } while((counter < 500) && (collision))
        if (counter === 500) {
            return { StartingSquare: { Row: "A", Column: -1 }, EndingSquare : { Row: "A", Column: 5 } };
        }
        return place;
    }

    private getSubmarinePlace(shipPlaces: ShipPlace[]): ShipPlace {
        let counter:number = 0;
        let place: ShipPlace = { StartingSquare: { Row: "G", Column: 1 }, EndingSquare : { Row: "G", Column: 3 } };
        let collision: boolean = false;
        do {
            let places: ShipPlace[] = shipPlaces.slice(0);
            collision = false;
            const row: string = String.fromCharCode(Math.floor(Math.random() * 10) + 65);
            const column: number = Math.floor(Math.random() * 10) + 1;
            if ((row > 'H') && (column > 8)) {
                continue;
            }
            if (((Math.random() < 0.5) && (row <= 'H')) || (column > 8)) {
                place = { StartingSquare: { Row: row, Column: column }, EndingSquare: { Row: String.fromCharCode(row.charCodeAt(0) + 2), Column: column } };
            } else {
                place = { StartingSquare: { Row: row, Column: column }, EndingSquare: { Row: row, Column: (column + 2) } };
            }
            places.push(place);
            if (this.detectCollision(places)) {
                collision = true;
                counter++;
            } else {
                console.log(JSON.stringify(places))
            }
        } while((counter < 500) && (collision))
        if (counter === 500) {
            return { StartingSquare: { Row: "A", Column: -1 }, EndingSquare : { Row: "A", Column: 5 } };
        }
        return place;
    }

    private getPatrolPlace(shipPlaces: ShipPlace[]): ShipPlace {
        let counter:number = 0;
        let place: ShipPlace = { StartingSquare: { Row: "I", Column: 1 }, EndingSquare : { Row: "I", Column: 2 } };
        let collision: boolean = false;
        do {
            let places: ShipPlace[] = shipPlaces.slice(0);
            collision = false;
            const row: string = String.fromCharCode(Math.floor(Math.random() * 10) + 65);
            const column: number = Math.floor(Math.random() * 10) + 1;
            if ((row > 'I') && (column > 9)) {
                continue;
            }
            if (((Math.random() < 0.5) && (row <= 'I')) || (column > 9)) {
                place = { StartingSquare: { Row: row, Column: column }, EndingSquare: { Row: String.fromCharCode(row.charCodeAt(0) + 1), Column: column } };
            } else {
                place = { StartingSquare: { Row: row, Column: column }, EndingSquare: { Row: row, Column: (column + 1) } };
            }
            places.push(place);
            if (this.detectCollision(places)) {
                collision = true;
                counter++;
            } else {
                console.log(JSON.stringify(places))
            }
        } while((counter < 500) && (collision))
        if (counter === 500) {
            return { StartingSquare: { Row: "A", Column: -1 }, EndingSquare : { Row: "A", Column: 5 } };
        }
        return place;
    }

    private detectCollision(shipPlaces: ShipPlace[]): boolean {
        //console.log(JSON.stringify(shipPlaces));
        for (let i: number = 0; i < shipPlaces.length - 1; i++) {
            let ship1: Position[] = this.generateShipSquares(shipPlaces[i]);
            for (let j: number = i + 1; j < shipPlaces.length; j++) {
                let ship2: Position[] = this.generateAdjacentSquares(this.generateShipSquares(shipPlaces[j]));
                //console.log("ship1: " + JSON.stringify(ship1));
                //console.log("ship2: " + JSON.stringify(ship2));
                for (let x: number = 0; x < ship1.length; x++) {
                    for (let y: number = 0; y < ship2.length; y++) {
                        if ((ship1[x].Row === ship2[y].Row) && (ship1[x].Column === ship2[y].Column)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    private generateShipSquares(shipPlace: ShipPlace): Position[] {
        let ship: Position[] = [];
        if (shipPlace.StartingSquare.Row === shipPlace.EndingSquare.Row) {
            for (let i: number = shipPlace.StartingSquare.Column; i <= shipPlace.EndingSquare.Column; i++) {
                ship.push({
                    Row: shipPlace.StartingSquare.Row,
                    Column: i
                });
            }
        } else {
            for (let i: number = shipPlace.StartingSquare.Row.charCodeAt(0); i <= shipPlace.EndingSquare.Row.charCodeAt(0); i++) {
                ship.push({
                    Row: String.fromCharCode(i),
                    Column: shipPlace.StartingSquare.Column
                });
            }
        }
        return ship;
    }

    private generateAdjacentSquares(ship: Position[]): Position[] {
        let squares: Position[] = [];
        for (let i: number = 0; i < ship.length; i++) {
            squares.push({ Row: ship[i].Row, Column: ship[i].Column + 1 });
            squares.push({ Row: ship[i].Row, Column: ship[i].Column - 1 });
            squares.push({ Row: String.fromCharCode(ship[i].Row.charCodeAt(0) + 1), Column: ship[i].Column });
            squares.push({ Row: String.fromCharCode(ship[i].Row.charCodeAt(0) - 1), Column: ship[i].Column });
        }
        squares.push({ Row: String.fromCharCode(ship[0].Row.charCodeAt(0) + 1), Column: ship[0].Column + 1 });
        squares.push({ Row: String.fromCharCode(ship[0].Row.charCodeAt(0) - 1), Column: ship[0].Column + 1 });
        squares.push({ Row: String.fromCharCode(ship[0].Row.charCodeAt(0) + 1), Column: ship[0].Column - 1 });
        squares.push({ Row: String.fromCharCode(ship[0].Row.charCodeAt(0) - 1), Column: ship[0].Column - 1 });
        squares.push({ Row: String.fromCharCode(ship[ship.length - 1].Row.charCodeAt(0) + 1), Column: ship[ship.length - 1].Column + 1 });
        squares.push({ Row: String.fromCharCode(ship[ship.length - 1].Row.charCodeAt(0) - 1), Column: ship[ship.length - 1].Column + 1 });
        squares.push({ Row: String.fromCharCode(ship[ship.length - 1].Row.charCodeAt(0) + 1), Column: ship[ship.length - 1].Column - 1 });
        squares.push({ Row: String.fromCharCode(ship[ship.length - 1].Row.charCodeAt(0) - 1), Column: ship[ship.length - 1].Column - 1 });
        return squares;
    }

    private randomShot(gamestate): Position {
        let position: Position = { Row: 'A', Column: 1 };
        let found: boolean = false;
        do {
            let row: string = ""
            let column: number = 0;
            if (Math.random() < 0.5) {
                row = String.fromCharCode(Math.floor(Math.random() * 5) * 2 + 65);
                column = Math.floor(Math.random() * 5) * 2 + 1;
            } else {
                row = String.fromCharCode(Math.floor(Math.random() * 5) * 2 + 66);
                column = Math.floor(Math.random() * 5) * 2 + 2;
            }
            position = { Row: row, Column: column};
            found = false;
            for (let i = 0; i < gamestate.MyShots.length; i++) {
                if ((gamestate.MyShots[i].Position.Row === position.Row) && (gamestate.MyShots[i].Position.Column === position.Column)) {
                    found = true;
                    break;
                }
            }
        } while (found)
        return position
    }

    private track(gamestate, snapCopy): Position {
            const hitmap: number[][] = this.generateHitMap(gamestate.MyShots);
            let lastHit: Position = null;
            let shot: Position = null;
            for (let i: number = gamestate.MyShots.length - 1; i >= 0; i--) {
                if (gamestate.MyShots[i].WasHit) {
                    lastHit = gamestate.MyShots[i].Position;
                    break;
                }
            }
            let up: boolean = true;
            let down: boolean = true;
            let left: boolean = true;
            let right: boolean = true;
            if ((lastHit.Column === 1) || (hitmap[lastHit.Row.charCodeAt(0)][lastHit.Column - 1] === 1)) {
                left = false;
            }
            if ((lastHit.Column === 10) || (hitmap[lastHit.Row.charCodeAt(0)][lastHit.Column + 1] === 1)) {
                right = false;
            }
            if ((lastHit.Row === 'A') || (hitmap[lastHit.Row.charCodeAt(0) - 1][lastHit.Column] === 1)) {
                up = false;
            }
            if ((lastHit.Row === 'J') || (hitmap[lastHit.Row.charCodeAt(0) + 1][lastHit.Column] === 1)) {
                down = false;
            }
            let maxboatsize: number = 5;
            if (snapCopy.sizes.carrier) {
                maxboatsize = 5;
            } else if (snapCopy.sizes.battleship) {
                maxboatsize = 4;
            } else if (snapCopy.sizes.destroyer || snapCopy.sizes.submarine) {
                maxboatsize = 3;
            } else {
                maxboatsize = 2;
            }
            let boatsize: number = 1;
            let offset: number = 1;
            if (up && (hitmap[lastHit.Row.charCodeAt(0) - 1][lastHit.Column] === 2)) {
                left = false;
                right = false;
                boatsize++;
                offset++;
                while (!(lastHit.Row.charCodeAt(0) - boatsize === 64) && (hitmap[lastHit.Row.charCodeAt(0) - boatsize][lastHit.Column] === 2)) {
                    boatsize++;
                    offset++;
                }
                if ((lastHit.Row.charCodeAt(0) - boatsize === 64) || (hitmap[lastHit.Row.charCodeAt(0) - boatsize][lastHit.Column] === 1)) {
                    up = false;
                    offset = 1;
                    let othersize: number = 0;
                    while (!(lastHit.Row.charCodeAt(0) + boatsize + 1 === 75) && (hitmap[lastHit.Row.charCodeAt(0) + othersize + 1][lastHit.Column] === 2)) {
                        othersize++;
                        offset++;
                    }
                    boatsize += othersize;
                    if ((lastHit.Row.charCodeAt(0) + boatsize + 1 === 75) || (hitmap[lastHit.Row.charCodeAt(0) + othersize + 1][lastHit.Column] === 1)) {
                        down = false;
                    }
                } else /*if (boatsize !== maxboatsize)*/ {
                    return { Row: String.fromCharCode(lastHit.Row.charCodeAt(0) - offset), Column: lastHit.Column }
                }
            } else if (down && (hitmap[lastHit.Row.charCodeAt(0) + 1][lastHit.Column] === 2)) {
                left = false;
                right = false;
                boatsize++;
                offset++;
                while (!(lastHit.Row.charCodeAt(0) + boatsize === 75) && (hitmap[lastHit.Row.charCodeAt(0) + boatsize][lastHit.Column] === 2)) {
                    boatsize++;
                    offset++;
                }
                if ((lastHit.Row.charCodeAt(0) + boatsize === 75) || (hitmap[lastHit.Row.charCodeAt(0) + boatsize][lastHit.Column] === 1)) {
                    down = false;
                    offset = 1;
                } else /*if (boatsize !== maxboatsize)*/ {
                    return { Row: String.fromCharCode(lastHit.Row.charCodeAt(0) + offset), Column: lastHit.Column }
                }
            } else if (left && (hitmap[lastHit.Row.charCodeAt(0)][lastHit.Column - 1] === 2)) {
                up = false;
                down = false;
                boatsize++;
                offset++;
                while (hitmap[lastHit.Row.charCodeAt(0)][lastHit.Column - boatsize] === 2) {
                    boatsize++;
                    offset++;
                }
                if ((hitmap[lastHit.Row.charCodeAt(0)][lastHit.Column - boatsize] === 1) || (lastHit.Column - boatsize === 0)) {
                    left = false;
                    offset = 1;
                    let othersize: number = 0;
                    while (hitmap[lastHit.Row.charCodeAt(0)][lastHit.Column + othersize + 1] === 2) {
                        othersize++;
                        offset++;
                    }
                    boatsize += othersize;
                    if (hitmap[lastHit.Row.charCodeAt(0)][lastHit.Column + othersize + 1] === 1) {
                        right = false;
                    }
                } else /*if (boatsize !== maxboatsize)*/ {
                    return { Row: lastHit.Row, Column: lastHit.Column - offset }
                }
            } else if (right && (hitmap[lastHit.Row.charCodeAt(0)][lastHit.Column + 1] === 2)) {
                up = false;
                down = false;
                boatsize++;
                offset++;
                while (hitmap[lastHit.Row.charCodeAt(0)][lastHit.Column + boatsize] === 2) {
                    boatsize++;
                    offset++;
                }
                if ((hitmap[lastHit.Row.charCodeAt(0)][lastHit.Column + boatsize] === 1) || (lastHit.Column + boatsize === 11)) {
                    right = false;
                    offset = 1;
                } else /*if (boatsize !== maxboatsize)*/ {
                    return { Row: lastHit.Row, Column: lastHit.Column + offset }
                }
            }
            /*if (boatsize === maxboatsize) {
                up = false;
                down = false;
                right = false;
                left = false;
            }*/
            /*console.log("last hit: " + lastHit.Row + lastHit.Column.toString());
            console.log("Up " + up);
            console.log("Down " + down);
            console.log("Left " + left);
            console.log("Right " + right);
            console.log(offset);*/
            if (up) {
                return { Row: String.fromCharCode(lastHit.Row.charCodeAt(0) - offset), Column: lastHit.Column }
            } else if (down) {
                return { Row: String.fromCharCode(lastHit.Row.charCodeAt(0) + offset), Column: lastHit.Column }
            } else if (left) {
                return { Row: lastHit.Row, Column: lastHit.Column - offset }
            } else if (right) {
                return { Row: lastHit.Row, Column: lastHit.Column + offset }
            } else {
                //console.log("Boatsize: " + boatsize.toString())
                snapCopy.hitmode = false;
                if (boatsize === 5) {
                    snapCopy.sizes.carrier = false;
                } else if (boatsize === 4) {
                    snapCopy.sizes.battleship = false;
                } else if (boatsize === 3) {
                    if (snapCopy.sizes.destroyer) {
                        snapCopy.sizes.destroyer = false;
                    } else {
                        snapCopy.sizes.submarine = false;
                    }
                } else {
                    snapCopy.sizes.patrol = false;
                }
                firebase.database().ref('matches/' + this.matchId.toString()).set(snapCopy);
                return this.randomShot(gamestate)
            }        
    }

    private generateHitMap(shots: Shot[]): number[][] {
        //console.log(shots);
        let map: number[][] = [];
        for (let i: number = 65; i < 75; i++) {
            const arr: number[] = [];
            arr.fill(0,1,12);
            map[i] = arr;
        }
        for (let i: number = 0; i < shots.length; i++) {
            if (shots[i].WasHit) {
                map[shots[i].Position.Row.charCodeAt(0)][shots[i].Position.Column] = 2;
            } else {
                map[shots[i].Position.Row.charCodeAt(0)][shots[i].Position.Column] = 1;
            }
        }
        return map;
    }
}

