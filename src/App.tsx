import React, { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import * as idb from "idb";

interface ImageFile {
    id: string;
    name: string;
    type: string;
    base64: string;
}

interface Card {
    id: string;
    backgroundId: number | null;
    value: string;
    valueDescription: string;
}

function imageFileToDataUrl(image: ImageFile) {
    return `data:${image.type};base64,${image.base64}`;
}

export function App() {
    const [database, setDatabase] = useState<idb.IDBPDatabase>();

    useEffect(() => {
        idb.openDB("cgs", 1, {
            upgrade: (db, oldVersion, newVersion, transaction) => {
                if (oldVersion === 0) {
                    db.createObjectStore("image", { keyPath: "id" });
                    db.createObjectStore("card", { keyPath: "id" });
                }
            },
        }).then(setDatabase);
    }, []);

    if (!database) {
        return <p>loading...</p>;
    } else {
        return <Dashboard database={database} />;
    }
}

export function Dashboard({ database }: { database: idb.IDBPDatabase }) {
    const [card, setCard] = useState<Card>();
    const [images, setImages] = useState<ImageFile[]>([]);

    async function refreshImages() {
        setImages(await database.getAll("image"));
    }

    useEffect(() => {
        refreshImages();
    }, []);

    return (
        <div>
            <div className="p-4 border">
                <h2 className="text-xl text-blue-500 font-bold">Foto's</h2>
                <input
                    multiple
                    className="my-2"
                    type="file"
                    onChange={async (ev) => {
                        let files = ev.target.files;
                        if (!files) return;

                        for (let i = 0; i < files.length; i++) {
                            let file = files[i];

                            let binary = "";
                            let bytes = new Uint8Array(await file.arrayBuffer());
                            for (let b = 0; b < bytes.byteLength; b++) {
                                binary += String.fromCharCode(bytes[b]);
                            }

                            let base64Raw = btoa(binary);
                            // let base64 = `data:image/png;base64,${base64Raw}`;
                            await database.add("image", { base64: base64Raw, type: file.type, name: file.name, id: nanoid() });
                            refreshImages();
                        }
                    }}
                />
                <div className="flex-grow flex flex-wrap ">
                    {images.map((file) => (
                        <div key={file.name} className="border">
                            <h2 className="text-sm font-mono px-2 pt-2">{file.name}</h2>
                            <p className="font-mono text-xs px-2 pb-2">{file.id}</p>
                            <img className="w-20 px-2" src={imageFileToDataUrl(file)} />
                            <button
                                className="px-4 py-2"
                                onClick={async () => {
                                    await database.delete("image", file.id);
                                    refreshImages();
                                }}>
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex">
                <button
                    onClick={() => {
                        let newCard = { value: "", valueDescription: "", id: nanoid(), backgroundId: null };
                        setCard(newCard);
                    }}>
                    New card
                </button>
                {card && (
                    <div className="flex-shrink-0 border-l">
                        <div className="grid" style={{ gridTemplateColumns: "200px 1fr" }}>
                            <label htmlFor="">Waarde</label>
                            <input placeholder="3" value={card.value} onChange={(ev) => setCard({ ...card, value: ev.target.value })} />
                            <label htmlFor="">Waarde beschrijving</label>
                            <input
                                placeholder="brie"
                                value={card.valueDescription}
                                onChange={(ev) => setCard({ ...card, valueDescription: ev.target.value })}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
