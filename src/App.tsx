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
    imageId?: number;
    imageHeight?: number;
    imageWidth?: number;
    imageX?: number;
    imageY?: number;
    value: string;
    valueDescription: string;
    text: string;
    description: string;
}

function imageFileToDataUrl(image: ImageFile) {
    return `data:${image.type};base64,${image.base64}`;
}

function imageFileToImage(image: ImageFile): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
        let img = new Image();
        img.onload = () => {
            res(img);
        };
        img.onerror = rej;
        img.src = imageFileToDataUrl(image);
    });
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
                                    let newCard = {
                                        value: "",
                                        valueDescription: "",
                                        id: nanoid(),
                                        imageX: 0,
                                        imageY: 0,
                                        imageHeight: 1200,
                                        imageWidth: 800,
                                    } as Card;
                                    await database.add("card", newCard);
                                    setCard(newCard);
                                    refreshCards();
                                }}>
                                New card
                            </button>
                        </div>
                        <div>
                            {cards.map((c) => (
                                <div
                                    className={"p-2 rounded-md bg-white border " + (c.id === card?.id ? "border-black" : "")}
                                    onClick={() => setCard(c)}>
                                    <h2 className="text-xl">
                                        {c.value} <small className="">{c.valueDescription}</small>
                                    </h2>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="border-l">
                    {card && (
                        <div className="flex-shrink-0 p-4">
                            <h2 className="text-xl font-bold mb-4">Kaart aanpassen</h2>
                            <CardForm
                                database={database}
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

function CardForm(props: { card: Card; onChange: (card: Card) => void; database: idb.IDBPDatabase }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>();
    const form = useForm(props.card);

    useEffect(() => {
        form.setValues(props.card);
    }, [props.card]);

    async function updateCanvas() {
        let w = canvasRef.current!.width,
            h = canvasRef.current!.height;
        let gl = canvasRef.current!.getContext("2d")!;
        gl.fillStyle = "white";
        gl.fillRect(0, 0, w, h);

        if (imageRef.current) {
            gl.drawImage(
                imageRef.current,
                form.values.imageX ?? 0,
                form.values.imageY ?? 0,
                form.values.imageWidth ?? w,
                form.values.imageHeight ?? h
            );
        }

        let bottomGradient = gl.createLinearGradient(0, 0, 0, h);
        bottomGradient.addColorStop(0.5, "#00000000");
        bottomGradient.addColorStop(1, "#000000aa");
        gl.fillStyle = bottomGradient;
        gl.fillRect(0, 0, w, h);

        let topGradient = gl.createLinearGradient(0, 0, 0, h);
        topGradient.addColorStop(0, "#000000aa");
        topGradient.addColorStop(0.5, "#00000000");
        gl.fillStyle = topGradient;
        gl.fillRect(0, 0, w, h);

        const BORDER_COLOR = "white";
        const BORDER_TEXT_COLOR = "#555555";
        const BORDER_TEXT_SMALL_COLOR = "#aaaaaa";

        // Draw border
        gl.strokeStyle = BORDER_COLOR;
        gl.fillStyle = BORDER_COLOR;
        gl.lineWidth = 30;
        const AMOUNT = 30;
        const ROUNDING = 40;
        gl.beginPath();
        gl.moveTo(0, 0);
        gl.lineTo(w, 0);
        gl.lineTo(w - AMOUNT, 0);
        gl.arcTo(w, 0, w, AMOUNT, ROUNDING);
        gl.lineTo(w, h);
        gl.lineTo(w, h - AMOUNT);
        gl.arcTo(w, h, w - AMOUNT, h, ROUNDING);
        gl.lineTo(0, h);
        gl.lineTo(AMOUNT, h);
        gl.arcTo(0, h, 0, h - AMOUNT, ROUNDING);
        gl.lineTo(0, 0);
        gl.lineTo(0, AMOUNT);
        gl.arcTo(0, 0, AMOUNT, 0, ROUNDING);
        gl.stroke();

        // Draw border corners
        const CORNER_RADIUS = 5;
        const TOP_CORNER_W = 130,
            TOP_CORNER_H = 180;
        gl.beginPath();
        gl.moveTo(0, 0);
        gl.lineTo(TOP_CORNER_W, 0);
        gl.lineTo(TOP_CORNER_W, TOP_CORNER_H - CORNER_RADIUS);
        gl.arcTo(TOP_CORNER_W, TOP_CORNER_H, TOP_CORNER_W - CORNER_RADIUS, TOP_CORNER_H, 20);
        gl.lineTo(0, TOP_CORNER_H);
        gl.fill();
        const BOTTOM_CORNER_W = 130,
            BOTTOM_CORNER_H = 180;
        gl.beginPath();
        gl.moveTo(w, h);
        gl.lineTo(w - BOTTOM_CORNER_W, h);
        gl.lineTo(w - BOTTOM_CORNER_W, h - BOTTOM_CORNER_H + CORNER_RADIUS);
        gl.arcTo(w - BOTTOM_CORNER_W, h - BOTTOM_CORNER_H, w - BOTTOM_CORNER_W + CORNER_RADIUS, h - BOTTOM_CORNER_H, 20);
        gl.lineTo(w, h - BOTTOM_CORNER_H);
        gl.fill();

        // Draw corner value
        gl.textAlign = "center";
        gl.fillStyle = BORDER_TEXT_COLOR;
        gl.font = "120px Bangers";

        gl.fillText(form.values.value, 62, 117);

        gl.save();
        gl.translate(w - 62, h - 117);
        gl.rotate(Math.PI);
        gl.fillText(form.values.value, 0, 0);
        gl.restore();

        // gl.rotate(Math.PI);

        // Draw corner value description
        if (form.values.valueDescription) {
            gl.fillStyle = BORDER_TEXT_SMALL_COLOR;
            gl.font = form.values.valueDescription.length > 10 ? "20px Bangers" : "30px Bangers";

            gl.fillText(form.values.valueDescription, 62, 160);

            gl.save();
            gl.translate(w - 62, h - 160);
            gl.rotate(Math.PI);
            gl.fillText(form.values.valueDescription, 0, 0);
            gl.restore();
        }

        if (form.values.text) {
            gl.textAlign = "center";
            gl.font = "50px Source Sans Pro";
            gl.fillStyle = "white";
            let lines = form.values.text.split("\n");
            for (let i = 0; i < lines.length; i++) {
                gl.fillText(lines[i], w / 2, h * 0.7 + i * 55);
            }
        }

        // gl.lineWidth = 50;
        // gl.strokeStyle = "yellow";
        // gl.strokeRect(0, 0, w, h);

        // gl.fillStyle = "white";
        // gl.fillRect(100, h / 2, w - 200, h / 2 - 100);
    }

    useEffect(() => {
        let imageId = form.listen("imageId", async () => {
            if (form.values.imageId) {
                if (!imageRef.current || form.values.imageId !== (imageRef.current as any).imageId) {
                    console.log("loading", form.values.imageId);
                    let dbImage = (await props.database.get("image", form.values.imageId)) as ImageFile;
                    if (dbImage) {
                        let img = await imageFileToImage(dbImage);
                        (img as any).imageId = form.values.imageId;
                        imageRef.current = img;
                        updateCanvas();
                    }
                }
            } else {
                imageRef.current = undefined;
            }
        });

        let id = form.listenAny(() => {
            setTimeout(() => updateCanvas(), 1);
        });
        return () => {
            form.ignore("imageId", imageId);
            form.ignoreAny(id);
        };
    }, []);

    return (
        <form
            className="flex flex-col"
            onSubmit={form.handleSubmit(() => {
                props.onChange(form.values);
            })}>
            <div className="grid gap-2" style={{ gridTemplateColumns: "200px 1fr" }}>
                <label htmlFor="">Waarde</label>
                <Field form={form} name="value" placeholder="3" />
                <label htmlFor="">Waarde beschrijving</label>
                <Field form={form} name="valueDescription" placeholder="brie" />
                <label htmlFor="">Tekst</label>
                <Field as="textarea" form={form} name="text" />
                <label htmlFor="">Beschrijving</label>
                <Field as="textarea" form={form} name="description" />
                <label htmlFor="">Foto id</label>
                <Field form={form} name="imageId" />
                <label htmlFor="">Foto x</label>
                <Field min={-400} max={400} type="range" form={form} name="imageX" />
                <label htmlFor="">Foto y</label>
                <Field min={-400} max={400} type="range" form={form} name="imageY" />
                <label htmlFor="">Foto w</label>
                <Field min={200} max={1600} type="range" form={form} name="imageWidth" />
                <label htmlFor="">Foto h</label>
                <Field min={200} max={2400} type="range" form={form} name="imageHeight" />

                <button type="submit" className="bg-blue-600 text-white">
                    Opslaan
                </button>
            </div>
            <canvas ref={canvasRef} className="border border-black my-4" width="800px" height="1200px" />
        </form>
    );
}
