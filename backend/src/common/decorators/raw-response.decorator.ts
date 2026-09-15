import { SetMetadata } from '@nestjs/common';

export const IS_RAW_RESPONSE_KEY = 'isRawResponse';

/** Marks a route whose return value must NOT be wrapped in { data } — e.g. a raw CSV file
 * download, where the body needs to match the Content-Type header exactly. */
export const RawResponse = () => SetMetadata(IS_RAW_RESPONSE_KEY, true);
