import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  PayloadTooLargeException,
  Post,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  PrescriptionReadError,
  type PrescriptionMediaType,
  type ReadPrescriptionResult,
} from '@recuidado/prescription-reader';
import { z } from 'zod';
import { confirmPrescriptionBody } from './confirm.schema.js';
import { PrescriptionsService } from './prescriptions.service.js';

/** Upper bound for the multipart upload; images above 5 MB are rejected by the reader. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ACCEPTED_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

/** The subset of the multer file object this controller uses. */
interface UploadedPrescription {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  /** Multipart upload with the photo in the "file" field. */
  @Post('parse')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  async parse(
    @UploadedFile() file: UploadedPrescription | undefined,
  ): Promise<ReadPrescriptionResult> {
    if (!file) {
      throw new BadRequestException('Envie a foto da receita no campo "file".');
    }
    if (!ACCEPTED_TYPES.has(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        'Formato não suportado. Envie JPG, PNG, WEBP ou PDF.',
      );
    }
    try {
      return await this.prescriptions.parse({
        data: file.buffer,
        mediaType: file.mimetype as PrescriptionMediaType,
      });
    } catch (error) {
      throw toHttpError(error);
    }
  }

  /** Saves the items the family reviewed and confirmed, then schedules their doses. */
  @Post('confirm')
  @HttpCode(201)
  confirm(@Body() body: unknown) {
    const result = confirmPrescriptionBody.safeParse(body);
    if (!result.success)
      throw new BadRequestException(z.prettifyError(result.error));
    return this.prescriptions.confirm(result.data);
  }
}

function toHttpError(error: unknown): unknown {
  if (!(error instanceof PrescriptionReadError)) return error;
  switch (error.code) {
    case 'too_large':
      return new PayloadTooLargeException(error.message);
    case 'unsupported_type':
      return new UnsupportedMediaTypeException(error.message);
    case 'refused':
      return new UnprocessableEntityException(error.message);
    case 'truncated':
    case 'invalid_output':
      return new BadGatewayException(error.message);
  }
}
