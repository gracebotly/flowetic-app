import { NextResponse } from 'next/server';
import { DeepgramVoice } from '@mastra/voice-deepgram';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side voice transcription endpoint
 * Handles Deepgram API calls with secure API key
 */
export async function POST(request: Request) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if API key is configured
    if (!process.env.DEEPGRAM_API_KEY) {
      console.error('[Voice API] DEEPGRAM_API_KEY not configured');
      return NextResponse.json(
        { error: 'Voice service not configured. Please contact support.' },
        { status: 500 }
      );
    }

    // Get audio data from request
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log('[Voice API] Processing audio file:', {
      userId: user.id,
      fileSize: audioFile.size,
      fileType: audioFile.type,
    });

    // Initialize Deepgram voice
    const deepgram = new DeepgramVoice({
      listeningModel: {
        name: 'nova-2',
        apiKey: process.env.DEEPGRAM_API_KEY,
        properties: {
          punctuate: true,
          smart_format: true,
          language: 'en',
        },
      },
    });

    // Convert File to ReadableStream
    const arrayBuffer = await audioFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const readableStream = new ReadableStream({
      start(controller) {
        controller.enqueue(uint8Array);
        controller.close();
      },
    });

    // Transcribe with Deepgram
    const transcript = await deepgram.listen(readableStream as any);

    console.log('[Voice API] Transcription successful:', {
      userId: user.id,
      transcriptLength: transcript.length,
    });

    return NextResponse.json({
      transcript,
      success: true,
    });

  } catch (error) {
    console.error('[Voice API] Transcription error:', error);

    return NextResponse.json(
      {
        error: 'Failed to transcribe audio',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
