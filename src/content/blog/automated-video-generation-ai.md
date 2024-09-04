---
author: Will Redington
pubDatetime: 2023-06-02T15:22:00Z
title: AI-generated video using ChatGPT
postSlug: ai-generated-video-chatgpt
featured: true
draft: false
tags:
  - ai
  - chatgpt
  - python
  - aws
  - typescript
  - node
ogImage: ""
description: How to create an AI-generated video using ChatGPT
---

We've all seen AI-generated images, what about video?

## Table of contents

## Process

1. ChatGPT creates the video transcript and sends it to us in JSON
2. For each section of the transcript, we want to translate the text into audio and get a GIF for the background
3. Have the user manually sign off on what was generated
4. Compile everything together and create a MP4 video file

## Technologies

- Chat GPT - generates the transcript based on a prompt
- Microsoft TTS - text to speech
- GIPHY - searches for a GIF
- MoviePy - compiles everything together into an MP4
- AWS CDK - infrastructure and whatnot

## Building Out the Basics

When we supply our prompt to ChatGPT, we get a response that looks something like this:

> Explain to me the basics of the Rust programming language

```json
{
  "video_transcript": [
    {
      "timestamp": "00:00:00",
      "text": "Welcome to our video on the basics of Rust programming language!",
      "gif": "rust programming language"
    },
    {
      "timestamp": "00:00:10",
      "text": "So, what is Rust? Rust is a systems programming language that focuses on performance, memory safety, and thread safety.",
      "gif": "rust code compilation"
    },
    {
      "timestamp": "00:00:25",
      "text": "One of the key features of Rust is its ownership system, which allows for safe memory management without the need for a garbage collector.",
      "gif": "rust memory safety"
    },
    {
      "timestamp": "00:00:40",
      "text": "Rust also supports functional programming concepts such as closures, high-order functions, and pattern matching.",
      "gif": "rust closures"
    },
    {
      "timestamp": "00:00:55",
      "text": "Another important aspect of Rust is its support for concurrent programming through its ownership and borrowing model.",
      "gif": "rust threads"
    },
    {
      "timestamp": "00:01:10",
      "text": "Rust has an active and growing community, which provides a great number of libraries and tools to help developers write efficient and reliable code.",
      "gif": "rust community"
    },
    {
      "timestamp": "00:01:25",
      "text": "Overall, Rust is a powerful and flexible language that is gaining popularity in the development community due to its performance, memory safety, and concurrency features.",
      "gif": "rust logo"
    }
  ]
}
```

## Data Model

We have basically two basic models derived from the data we get from ChatGPT: Project and Project Section. We'll want to validate things as well since we're in a lambda environment, so we'll be using zod to model and validate in one go. Everything will be based on the data we get from Chat GPT, let's look at an example based on a prompt:

### Project

Our project has a status and some basic fields, but most importantly the `topic` which is the supplied value from the user

```typescript
import { z } from "zod";

export enum ProjectStatus {
  InProgress = "InProgress",
  NeedsApproval = "NeedsApproval",
  Finalizing = "Finalizing",
  Failed = "Failed",
  Completed = "Completed",
}

export const Project = z.object({
  id: z.string(),
  userId: z.string(),
  topic: z.string(),
  status: z.nativeEnum(ProjectStatus),
  createdAt: z.string(),
});

export type Project = z.infer<typeof Project>;
```

### Project Section

The "sections" are essentially the different items in the transcript array provided by ChatGPT. Ultimately we'll store the files in s3. We need a bucket for both GIFs as well as the audio files from the TTS service.

```typescript
import { z } from "zod";

export const ProjectSection = z.object({
  id: z.string(),
  projectId: z.string(),
  text: z.string(),
  gifHint: z.string(),
  createdAt: z.string(),
  gifFilePath: z.string().optional(),
  audioFilePath: z.string().optional(),
});

export type ProjectSection = z.infer<typeof ProjectSection>;

export type ProjectSectionKey = {
  id: string;
  projectId: string;
};
```

## Dynamo

We'll be storing our two models in DynamoDB. We know in advance the kind of operations we want to perform:

1. Get all the projects for a user
2. Get all the sections for a project
3. Basic CRUD on project and sections

```typescript
import { aws_dynamodb as dynamo } from "aws-cdk-lib";
import { Construct } from "constructs";

export class TableConstruct extends Construct {
  readonly projectTable: dynamo.Table;
  readonly projectSectionTable: dynamo.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.projectTable = new dynamo.Table(scope, "ProjectTable", {
      partitionKey: { name: "userId", type: dynamo.AttributeType.STRING },
      sortKey: {
        name: "id",
        type: dynamo.AttributeType.STRING,
      },
    });

    this.projectSectionTable = new dynamo.Table(scope, "ProjectSectionTable", {
      partitionKey: { name: "projectId", type: dynamo.AttributeType.STRING },
      sortKey: {
        name: "id",
        type: dynamo.AttributeType.STRING,
      },
    });
  }
}
```

Next we need someway to actually access Dynamo, we'll use ChatGPT to write the code for a basic implementation and then add zod for validation. And then we'll write some basic services for the project and section.

```typescript
import { DynamoDB } from "aws-sdk";
import { Result, Ok, Err } from "oxide.ts";
import { z, ZodSchema } from "zod";

export class DbClient<T> {
  private tableName: string;
  private schema: ZodSchema<T>;
  private documentClient: DynamoDB.DocumentClient;

  constructor(schema: ZodSchema<T>, tableName: string) {
    this.schema = schema;
    this.tableName = tableName;
    this.documentClient = new DynamoDB.DocumentClient();
  }

  private validateItem(item: any): Result<T, string> {
    const parsedResult = this.schema.safeParse(item);

    if (!parsedResult.success) {
      console.error(parsedResult.error);
      return Err("error validation item");
    }

    return Ok(parsedResult.data);
  }

  async getItem(key: DynamoDB.DocumentClient.Key): Promise<Result<T, string>> {
    const params: DynamoDB.DocumentClient.GetItemInput = {
      TableName: this.tableName,
      Key: key,
    };

    try {
      const result = await this.documentClient.get(params).promise();
      return this.validateItem(result.Item);
    } catch (error) {
      console.error("Error retrieving item from DynamoDB:", error);
      return Err("Error retrieving item from DynamoDB");
    }
  }

  // ...ETC
}
```

Project Service

```typescript
export class ProjectService {
  private readonly client: DbClient<Project>;

  constructor(projectTableName: string) {
    this.client = new DbClient<Project>(Project, projectTableName);
  }

  createProject({ userId, topic }: { userId: string; topic: string }) {
    return this.client.putItem({
      id: v4(),
      userId,
      topic,
      status: ProjectStatus.InProgress,
      createdAt: new Date().toISOString(),
    });
  }

  updateProject({
    key,
    status,
  }: {
    key: {
      id: string;
      userId: string;
    };
    status: ProjectStatus;
  }) {
    return this.client.updateItem(key, {
      status,
    });
  }

  getProjectsForUser({ userId }: { userId: string }) {
    return this.client.getItems({
      KeyConditionExpression: "#userKey = :userKeyValue",
      ExpressionAttributeNames: { "#userKey": "userId" },
      ExpressionAttributeValues: { ":userKeyValue": userId },
    });
  }
}
```

Section Service

```typescript
export class SectionService {
  private readonly client: DbClient<ProjectSection>;

  constructor(sectionTableName: string) {
    this.client = new DbClient<ProjectSection>(
      ProjectSection,
      sectionTableName
    );
  }

  createSection({
    text,
    gifHint,
    projectId,
  }: {
    text: string;
    gifHint: string;
    projectId: string;
  }) {
    return this.client.putItem({
      id: v4(),
      text,
      gifHint,
      projectId,
      createdAt: new Date().toISOString(),
    });
  }

  updateSection({
    key,
    updateProps,
  }: {
    key: ProjectSectionKey;
    updateProps: Partial<Pick<ProjectSection, "gifFilePath" | "audioFilePath">>;
  }) {
    return this.client.updateItem(key, updateProps);
  }

  getSectionsForProject({ projectId }: { projectId: string }) {
    return this.client.getItems({
      KeyConditionExpression: "#projectKey = :projectKeyValue",
      ExpressionAttributeNames: { "#projectKey": "projectId" },
      ExpressionAttributeValues: { ":projectKeyValue": projectId },
    });
  }
}
```

## S3

Next we need three different buckets, GIF, audio, and video:

```typescript
import { aws_s3 as s3 } from "aws-cdk-lib";
import { Construct } from "constructs";

export class BucketConstruct extends Construct {
  readonly audioBucket: s3.Bucket;
  readonly gifBucket: s3.Bucket;
  readonly videoBucket: s3.Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.audioBucket = new s3.Bucket(scope, "AudioBucket");
    this.gifBucket = new s3.Bucket(scope, "GIFBucket");
    this.videoBucket = new s3.Bucket(scope, "VideoBucket");
  }
}
```

## Step Functions

We want to leverage step functions so we can break things out in a more defined way

### Start Project State Machine

We want a step function to kick things off and do the following:

1. Create a project
2. Get the video transcript for ChatGPT
3. Transcribe the audio and get the GIF for each section
4. Set the project in a "Needs Approval" status

```typescript
const failProjectTask = new tasks.LambdaInvoke(scope, "FailProjectInvoke", {
  lambdaFunction: props.updateProjectLambda,
  payload: sfn.TaskInput.fromObject({
    projectId: sfn.JsonPath.stringAt("$.id"),
    projectStatus: ProjectStatus.Failed,
  }),
});

const getTranscriptTask = new tasks.LambdaInvoke(scope, "GetTranscriptInvoke", {
  lambdaFunction: props.getTranscriptLambda,
  resultPath: "$.sections",
  payloadResponseOnly: true,
}).addCatch(failProjectTask, {
  resultPath: "$.errors",
});

const sectionTasks = new sfn.Map(scope, "SectionMap", {
  itemsPath: "$.sections",
  resultPath: "$.sectionResults",
})
  .iterator(
    new tasks.LambdaInvoke(scope, "TextToAudioInvoke", {
      lambdaFunction: props.textToAudioLambda,
      resultPath: "$.audioResult",
      payloadResponseOnly: true,
    })
      .next(
        new tasks.LambdaInvoke(scope, "GetGifInvoke", {
          lambdaFunction: props.getGifLambda,
          resultPath: "$.gifResult",
          payloadResponseOnly: true,
        })
      )
      .next(
        new tasks.LambdaInvoke(scope, "UpdateSectionInvoke", {
          lambdaFunction: props.updateSectionLambda,
          payload: sfn.TaskInput.fromObject({
            sectionId: sfn.JsonPath.stringAt("$.id"),
            projectId: sfn.JsonPath.stringAt("$.projectId"),
            audioBucketLocation: sfn.JsonPath.stringAt("$.audioResult"),
            gifBucketLocation: sfn.JsonPath.stringAt("$.gifResult"),
          }),
        })
      )
  )
  .addCatch(failProjectTask, {
    resultPath: "$.errors",
  });

const pendingApprovalTask = new tasks.LambdaInvoke(
  scope,
  "PendingApprovalInvoke",
  {
    lambdaFunction: props.updateProjectLambda,
    payload: sfn.TaskInput.fromObject({
      projectId: sfn.JsonPath.stringAt("$.id"),
      projectStatus: ProjectStatus.NeedsApproval,
    }),
  }
).addCatch(failProjectTask, {
  resultPath: "$.errors",
});

return new sfn.StateMachine(scope, "StartProjectStateMachine", {
  definition: getTranscriptTask.next(sectionTasks).next(pendingApprovalTask),
});
```

Our step function first gets the transcript and then runs the different processes for each section. We'll define the lambdas later

### Finalize Project State Machine

We want this step function to be run after the user has approved the contents

1. Mark the project as "Finalizing"
2. Compile everything together
3. Mark the project as "Completed"

```typescript
const finalizingTask = new tasks.LambdaInvoke(scope, "FinalizingInvoke", {
  lambdaFunction: props.updateProjectLambda,
  payload: sfn.TaskInput.fromObject({
    projectId: sfn.JsonPath.stringAt("$.id"),
    projectStatus: ProjectStatus.Finalizing,
  }),
}).addCatch(failProjectTask, {
  resultPath: "$.errors",
});

const completeTask = new tasks.LambdaInvoke(scope, "CompleteInvoke", {
  lambdaFunction: props.updateProjectLambda,
  payload: sfn.TaskInput.fromObject({
    projectId: sfn.JsonPath.stringAt("$.id"),
    projectStatus: ProjectStatus.Completed,
  }),
}).addCatch(failProjectTask, {
  resultPath: "$.errors",
});

const movieMakerTask = new tasks.LambdaInvoke(scope, "MovieMakerInvoke", {
  lambdaFunction: props.movieMakerLambda,
});

return new sfn.StateMachine(scope, "FinalizeProjectStateMachine", {
  definition: finalizingTask.next(movieMakerTask).next(completeTask),
});
```

## Lambdas

We need a few lambdas to get things working:

- Start project - kick off the start project state machine
- Get GIF - gets the GIF for a section and stores it in s3
- Text to audio - transcribes the text to audio and stores it in s3
- Get transcript - gets the transcript from ChatGPT
- Movie maker - python script to compile everything into a MP4 file

We'll need a few more small lambdas for the final version, but this provides a basic outline of what we'll need.

### Start Project Lambda

This lambda is responsible for starting the "start project step function" process

```typescript
const stepfunctions = new AWS.StepFunctions();

const Event = z.object({
  topic: z.string(),
});

export const handler: APIGatewayProxyHandler = async (
  incomingEvent: APIGatewayProxyEvent
) => {
  const eventResult = Event.safeParse(JSON.parse(incomingEvent.body ?? ""));

  if (!eventResult.success) {
    return {
      statusCode: 400,
      body: "Invalid request body",
    };
  }

  const event = eventResult.data;

  const projectService = new ProjectService(
    getEnvVariable(RunTimeEnvVariable.PROJECT_TABLE_NAME)
  );

  try {
    const projectsForUser = await projectService.getProjectsForUser({
      userId: "user-1",
    });

    // check if the user already has pending projects
    const hasPendingOrActiveProjects = projectsForUser
      .unwrap()
      .some(
        project =>
          project.status === ProjectStatus.InProgress ||
          project.status === ProjectStatus.NeedsApproval
      );

    if (hasPendingOrActiveProjects) {
      return {
        statusCode: 409,
        body: "A Project is already running or needs approval",
      };
    }

    const project = (
      await projectService.createProject({
        userId: "user-1",
        topic: event.topic,
      })
    ).unwrap();

    const params: AWS.StepFunctions.StartExecutionInput = {
      input: JSON.stringify(project),
      stateMachineArn: getEnvVariable(
        RunTimeEnvVariable.START_PROJECT_STATE_MACHINE_ARN
      ),
    };

    // start the step function
    await stepfunctions.startExecution(params).promise();

    return {
      statusCode: 201,
      body: JSON.stringify(project),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: "An unknown error occurred",
    };
  }
};
```

### Get GIF Lambda

This lambda gets the GIF for an individual section from the transcript and then uploads the file to s3.

```typescript
import { Handler } from "aws-lambda";
import * as AWS from "aws-sdk";
import axios from "axios";
import { RunTimeEnvVariable, getEnvVariable } from "../config";
import { ProjectSection } from "../model";
import { getGIFs } from "../service/gif";

const s3 = new AWS.S3();

export const handler: Handler = async (incomingEvent): Promise<string> => {
  console.log(incomingEvent);

  const section = ProjectSection.parse(incomingEvent);

  const gifResult = await getGIFs(section.gifHint);

  if (gifResult.data.length) {
    const gif = gifResult.data[0].images.downsized;

    const gifStreamResult = await axios.get<ReadableStream>(gif.url, {
      responseType: "stream",
    });

    const bucketResult = await s3
      .upload({
        Bucket: getEnvVariable(RunTimeEnvVariable.GIF_BUCKET_NAME),
        Key: `${section.id}.gif`,
        ContentType: "image/gif",
        Body: gifStreamResult.data,
      })
      .promise();

    return bucketResult.Location;
  }

  throw new Error("could not find a GIF for section");
};
```

### Text To Audio Lambda

This lambda uses the Microsoft TTS API to transcribe the text to audio and uploads the result to s3.

```typescript
const s3 = new AWS.S3();

const speechConfig = tts.SpeechConfig.fromSubscription(
  getSecretValueFromEnv(SecretName.SPEECH_KEY),
  getSecretValueFromEnv(SecretName.SPEECH_REGION)
);

export const handler: Handler = async (incomingEvent): Promise<string> => {
  const section = ProjectSection.parse(incomingEvent);

  const synthesizer = new tts.SpeechSynthesizer(speechConfig);

  try {
    const ttsResult = await new Promise<PassThrough>((resolve, reject) => {
      synthesizer.speakTextAsync(
        section.text,
        result => {
          if (result.reason === tts.ResultReason.SynthesizingAudioCompleted) {
            const { audioData } = result;
            const bufferStream = new PassThrough();
            bufferStream.end(Buffer.from(audioData));
            resolve(bufferStream);
          }
        },
        error => {
          console.error(error);
          reject("there was an issue transcribing the audio");
        }
      );
    });

    const bucketResult = await s3
      .upload({
        Bucket: getEnvVariable(RunTimeEnvVariable.AUDIO_BUCKET_NAME),
        Key: `${section.id}.wav`,
        ContentType: "audio/wav",
        Body: ttsResult,
      })
      .promise();

    return bucketResult.Location;
  } catch (err) {
    throw err;
  } finally {
    synthesizer.close();
  }
};
```

### Get Transcript Lambda

This is arguably the most important lambda, and gets the results from ChatGPT. The most important piece is the "INITIAL_PROMPT". We limit the transcript to be under 5 minutes so we don't incur too much costs.

```typescript
const TranscriptResponse = z.object({
  video_transcript: z.array(
    z.object({
      timestamp: z.string(),
      text: z.string(),
      gifHint: z.string(),
    })
  ),
});

const configuration = new Configuration({
  apiKey: getSecretValueFromEnv(SecretName.OPENAI_API_KEY),
});

const openai = new OpenAIApi(configuration);

const MODEL = "gpt-3.5-turbo";

const INITIAL_PROMPT = `
  I want to create a video transcript based on an initial prompt about a topic.
  I'd like you to create the transcript. And for each section of the transcript, I'd like you to include both the text and a GIF hint.  For the GIF hint, it should be the search term for a GIF that goes along with whatever it is the transcript is talking about at that point in time. I'd like you to format the transcript in JSON like in the following example for a topic on the beagle dog breed:

  {
      "video_transcript": [ 
          { 
              "timestamp": "00:00:00", 
              "text": "Welcome to our video on the basic overview of the Beagle dog breed!",
              "gifHint": "beagle puppy" 
          }
      ]
  }

  Just provide the JSON and nothing else. Make sure to keep the transcript under 5 minutes.
  Next, I will provide the topic that you will create the transcript for.
`;

export const handler: Handler = async incomingEvent => {
  const project = Project.parse(incomingEvent);

  const completion = await openai.createChatCompletion({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: INITIAL_PROMPT,
      },
      {
        role: "user",
        content: project.topic,
      },
    ],
  });

  const transcriptJsonRaw = JSON.parse(
    completion.data.choices?.[0].message?.content ?? ""
  );

  const transcriptResponseResult =
    TranscriptResponse.safeParse(transcriptJsonRaw);

  if (!transcriptResponseResult.success) {
    console.log(transcriptResponseResult.error);
    throw new Error("unexpected transcript response");
  }

  const sectionService = new SectionService(
    getEnvVariable(RunTimeEnvVariable.SECTION_TABLE_NAME)
  );

  const sections: ProjectSection[] = [];

  for (const sectionRaw of transcriptResponseResult.data["video_transcript"]) {
    const sectionResult = await sectionService.createSection({
      text: sectionRaw.text,
      projectId: project.id,
      gifHint: sectionRaw.gifHint,
    });

    sections.push(sectionResult.unwrap());
  }

  return sections;
};
```

### Movie Maker Lambda

This python script uses moviepy to compile everything into a lambda. It uses docker because moviepy has some external dependencies.
This lambda will read the files from s3, combine them all together, loop the GIFs, and upload the video to the video s3 bucket.

```python
s3 = boto3.client("s3")

OUT_DIR = "/tmp/output"


def remove_and_create_directory(directory_path):
    # Remove the directory if it exists
    if os.path.exists(directory_path):
        shutil.rmtree(directory_path)

    # Create the directory
    os.makedirs(directory_path)


def generate_random_file_name(length=10):
    allowed_chars = string.ascii_letters + string.digits + "_-"
    return "".join(random.choice(allowed_chars) for _ in range(length))


def upload_file_to_s3(file_path, bucket_name, object_key):
    s3.upload_file(file_path, bucket_name, object_key)


def download_file_from_s3(http_url, file_extension):
    parsed_url = urlparse(http_url)
    bucket_name = parsed_url.netloc.split(".")[0]
    object_key = parsed_url.path[1:]  # Remove the leading slash from the object key

    presigned_url = s3.generate_presigned_url(
        ClientMethod="get_object", Params={"Bucket": bucket_name, "Key": object_key}
    )

    response = requests.get(presigned_url)
    file_path = f"{OUT_DIR}/{generate_random_file_name()}.{file_extension}"

    with open(file_path, "wb") as file:
        file.write(response.content)

    return file_path


def parse_project_sections(sections):
    parsed_sections = []

    for section in sections:
        gif_file = download_file_from_s3(section["gifFilePath"], "gif")
        audio_file = download_file_from_s3(section["audioFilePath"], "wav")
        parsed_sections.append((section["text"], gif_file, audio_file))

    return parsed_sections


def generate_video_clip(text, audio_path, gif_path):
    audio_clip = mpy.AudioFileClip(audio_path)

    gif_clip = mpy.VideoFileClip(gif_path)
    gif_clip.set_audio(audio_clip)
    # loop the GIF to match the audio length
    gif_clip = gif_clip.loop(duration=audio_clip.duration)

    text_clip = mpy.TextClip(
        text,
        color="black",
        method="caption",
        size=(0.8 * gif_clip.size[0], 100),
    )

    text_clip = text_clip.set_position("center")

    final_clip = mpy.CompositeVideoClip([gif_clip, text_clip])
    final_clip.audio = audio_clip
    final_clip = final_clip.set_duration(audio_clip.duration)

    return final_clip


def process_video(project_id, sections, video_bucket_name):
    clips = []

    for text, gif_file, audio_file in sections:
        clips.append(generate_video_clip(text, audio_file, gif_file))

    print("compiling all video clips...")
    video_file_path = f"{generate_random_file_name()}.mp4"
    final_clip = mpy.concatenate_videoclips(clips, method="compose")
    final_clip.write_videofile(video_file_path, fps=15)

    print("uploading to s3")
    upload_file_to_s3(video_file_path, video_bucket_name, f"{project_id}.mp4")

    print(f"uploaded video to s3 for project {project_id}")


def handler(event, context):
    video_bucket_name = os.getenv("VIDEO_BUCKET_NAME")

    remove_and_create_directory(OUT_DIR)
    print("parsing sections...")
    sections = parse_project_sections(event["sections"])
    process_video(event["projectId"], sections, video_bucket_name)
```

## Next Steps

In part 2 we'll combine all of the pieces we've built and deploy it to AWS.
