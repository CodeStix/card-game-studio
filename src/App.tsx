import React, { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import * as idb from "idb";
import { Field, useForm } from "typed-react-form";

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
    const [cards, setCards] = useState<Card[]>([]);

    async function refreshImages() {
        setImages(await database.getAll("image"));
    }

    async function refreshCards() {
        setCards(await database.getAll("card"));
    }

    useEffect(() => {
        refreshImages();
        refreshCards();
    }, []);

    return (
        <div className="h-full flex flex-col">
            <div className="bg-white border-b px-4 py-2 font-bold text-blue-500">CARD GAME STUDIO</div>
            <div className="grid grid-cols-3 bg-gray-100 flex-grow">
                <div className="p-4">
                    <h2 className="text-xl font-bold">{images.length} foto's</h2>
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
                            <div key={file.name} className="border bg-white rounded-md">
                                <h2 className="text-sm font-mono px-2 pt-2">
                                    <input
                                        defaultValue={file.name}
                                        onBlur={async (ev) => {
                                            await database.put("image", {
                                                ...file,
                                                name: ev.target.value,
                                            });
                                            refreshImages();
                                        }}
                                    />
                                </h2>
                                <p className="font-mono text-xs px-2 pb-2">{file.id}</p>
                                <img className="w-20 px-2" src={imageFileToDataUrl(file)} />
                                <button
                                    className="px-4 py-2 text-red-600"
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
                <div className="border-l">
                    <div className="p-4">
                        <div className="flex mb-2">
                            <h2 className="text-xl font-bold">{cards.length} kaarten</h2>
                            <button
                                className="px-2 py-1 bg-blue-600 text-white ml-auto"
                                onClick={async () => {
                                    let newCard = { value: "", valueDescription: "", id: nanoid(), backgroundId: null } as Card;
                                    await database.add("card", newCard);
                                    setCard(newCard);
                                }}>
                                New card
                            </button>
                        </div>
                        <div>
                            {cards.map((card) => (
                                <div className="p-2 bg-white border" onClick={() => setCard(card)}>
                                    <h2 className="text-xl">
                                        {card.value} <small className="">{card.valueDescription}</small>
                                    </h2>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="border-l">
                    {card && (
                        <div className="flex-shrink-0 p-4">
                            <CardForm
                                card={card}
                                onChange={async (c) => {
                                    await database.put("card", c);
                                    refreshCards();
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function CardForm(props: { card: Card; onChange: (card: Card) => void }) {
    const form = useForm(props.card);

    return (
        <form
            onSubmit={form.handleSubmit(() => {
                props.onChange(form.values);
            })}>
            <div className="grid gap-2" style={{ gridTemplateColumns: "200px 1fr" }}>
                <label htmlFor="">Waarde</label>
                <Field form={form} name="value" placeholder="3" />
                <label htmlFor="">Waarde beschrijving</label>
                <Field form={form} name="valueDescription" placeholder="brie" />
                <button className="bg-blue-600 text-white">Opslaan</button>
            </div>
        </form>
    );
}
